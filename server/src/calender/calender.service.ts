import { OAuth2Client } from 'google-auth-library';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { calendar_v3 } from 'googleapis';
import appConfig from '../config/env/app.config';
import { extractRoomByEmail, extractRoomName, isRoomAvailable, toMs, validateEmail } from './util/calender.util';
import { AuthService } from '../auth/auth.service';
import { ConferenceRoom } from '../auth/entities';
import { ApiResponse, DeleteResponse, EventResponse, EventUpdateResponse } from '@bookify/shared';
import { createResponse } from '../helpers/payload.util';
import { GoogleApiService } from 'src/google-api/google-api.service';

@Injectable()
export class CalenderService {
  constructor(
    @Inject(appConfig.KEY) private config: ConfigType<typeof appConfig>,
    private authService: AuthService,
    @Inject('GoogleApiService') private readonly googleApiService: GoogleApiService,
  ) {}

  async createEvent(
    client: OAuth2Client,
    domain: string,
    startTime: string,
    endTime: string,
    createConference?: boolean,
    eventTitle?: string,
    attendees?: string[],
    room?: string, //todo: this is a required field. change BookRoomDto
  ): Promise<ApiResponse<EventResponse>> {
    const rooms = await this.authService.getCalenderResources(domain);

    const attendeeList = [];
    if (attendees?.length) {
      for (const attendee of attendees) {
        if (validateEmail(attendee)) {
          attendeeList.push({ email: attendee });
        } else {
          throw new BadRequestException('Invalid attendee email provided: ' + attendee);
        }
      }
    }

    let conference = {};
    if (createConference) {
      conference = {
        conferenceData: {
          createRequest: {
            requestId: Math.random().toString(36).substring(7),
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },
      };
    }

    const pickedRoom = extractRoomByEmail(rooms, room);

    if (!pickedRoom) {
      throw new NotFoundException('Incorrect room picked!');
    }

    var event: calendar_v3.Schema$Event = {
      summary: eventTitle?.trim() || 'Quick Meeting | Bookify',
      location: pickedRoom.name,
      description: 'A quick meeting created by Bookify',
      start: {
        dateTime: startTime,
      },
      end: {
        dateTime: endTime,
      },
      attendees: [...attendeeList, { email: pickedRoom.email }],
      colorId: '3',
      ...conference,
    };

    const createdEvent = await this.googleApiService.createCalenderEvent(client, event);

    console.log('Room has been booked', createdEvent);

    const data: EventResponse = {
      eventId: createdEvent.id,
      summary: createdEvent.summary,
      meet: createdEvent.hangoutLink,
      start: createdEvent.start.dateTime,
      end: createdEvent.end.dateTime,
      room: pickedRoom.name,
      roomEmail: pickedRoom.email,
      roomId: pickedRoom.id,
      seats: pickedRoom.seats,
    };

    return createResponse(data, 'Room has been booked');
  }

  async getHighestSeatCapacity(domain: string) {
    const rooms = await this.authService.getCalenderResources(domain);
    let max = -1;
    for (const room of rooms) {
      if (room.seats > max) {
        max = room.seats;
      }
    }

    return createResponse(max);
  }

  async getAvailableRooms(
    client: OAuth2Client,
    domain: string,
    start: string,
    end: string,
    minSeats: number,
    timeZone: string,
    floor?: string,
  ): Promise<ConferenceRoom[]> {
    const filteredRoomEmails: string[] = [];
    const rooms = await this.authService.getCalenderResources(domain);

    for (const room of rooms) {
      if (room.seats >= minSeats && (floor === undefined || room.floor === floor)) {
        filteredRoomEmails.push(room.email);
      }
    }

    const calenders = await this.googleApiService.getCalenderSchedule(client, start, end, timeZone, filteredRoomEmails);

    const availableRooms: ConferenceRoom[] = [];
    let room: ConferenceRoom = null;

    for (const roomEmail of Object.keys(calenders)) {
      const isAvailable = isRoomAvailable(calenders[roomEmail].busy, new Date(start), new Date(end));
      if (isAvailable) {
        room = rooms.find((room) => room.email === roomEmail);
        availableRooms.push(room);
      }
    }

    return availableRooms;
  }

  async isRoomAvailable(client: OAuth2Client, start: string, end: string, roomEmail: string, timeZone?: string): Promise<boolean> {
    const calenders = await this.googleApiService.getCalenderSchedule(client, start, end, timeZone, [roomEmail]);

    const availableRooms: ConferenceRoom[] = [];
    let room: ConferenceRoom = null;

    for (const roomEmail of Object.keys(calenders)) {
      const isAvailable = isRoomAvailable(calenders[roomEmail].busy, new Date(start), new Date(end));
      if (isAvailable) {
        availableRooms.push(room);
      }
    }

    if (availableRooms.length === 0) {
      return false;
    }

    return true;
  }

  async listRooms(client: OAuth2Client, domain: string, startTime: string, endTime: string, timeZone: string): Promise<ApiResponse<EventResponse[]>> {
    const rooms = await this.authService.getCalenderResources(domain);
    const events = await this.googleApiService.getCalenderEvents(client, startTime, endTime, timeZone);

    const formattedEvents = events.map((event) => {
      let room: ConferenceRoom = rooms.find((_room) => event.location.includes(_room.name));

      const _event: EventResponse = {
        meet: event.hangoutLink ? event.hangoutLink.split('/').pop() : undefined,
        room: room.name,
        roomEmail: room.email,
        eventId: event.id,
        seats: room.seats,
        floor: room.floor,
        summary: event.summary,
        start: event.start.dateTime,
        end: event.end.dateTime,
      };

      return _event;
    });

    return createResponse(formattedEvents);
  }

  async updateEventDuration(client: OAuth2Client, eventId: string, roomId: string, duration: number): Promise<ApiResponse<EventUpdateResponse>> {
    const event = await this.googleApiService.getCalenderEvent(client, eventId);

    const { start, end } = event;

    // start time
    const startMs = new Date(start.dateTime).getTime();

    // end time
    const endMs = new Date(end.dateTime).getTime();

    const newDurationInMs = toMs(duration);
    const eventDurationInMs = endMs - startMs;

    let newEnd: string;

    if (newDurationInMs === eventDurationInMs) {
      throw new BadRequestException('Duration has already been set to ' + duration + ' mins');
    } else if (newDurationInMs < eventDurationInMs && newDurationInMs >= toMs(15)) {
      newEnd = new Date(endMs - (eventDurationInMs - newDurationInMs)).toISOString();
    } else {
      const newStart = end.dateTime;
      newEnd = new Date(endMs + (newDurationInMs - eventDurationInMs)).toISOString();

      // check if room is available within newStart and newEnd
      const isAvailable = await this.isRoomAvailable(client, newStart, newEnd, roomId, start.timeZone);
      if (!isAvailable) {
        throw new ForbiddenException('Room is not available within time range');
      }
    }

    // update the room
    const newEvent: calendar_v3.Schema$Event = {
      ...event,
      end: {
        dateTime: newEnd,
        timeZone: end.timeZone,
      },
    };

    const result = await this.googleApiService.updateCalenderEvent(client, eventId, newEvent);

    const data: EventUpdateResponse = {
      start: result.start.dateTime,
      end: result.end.dateTime,
    };

    return createResponse(data, 'Room has been updated');
  }

  async deleteEvent(client: OAuth2Client, id: string): Promise<ApiResponse<DeleteResponse>> {
    await this.googleApiService.deleteEvent(client, id);

    const data: DeleteResponse = {
      deleted: true,
    };

    return createResponse(data, 'Event deleted');
  }

  async listFloors(domain: string): Promise<ApiResponse<string[]>> {
    const floors = await this.authService.getFloorsByDomain(domain);
    return createResponse(floors);
  }
}
