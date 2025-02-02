import { admin_directory_v1, calendar_v3, oauth2_v2 } from 'googleapis';

export class CalenderMockDb {
  events: calendar_v3.Schema$Event[];
  rooms: admin_directory_v1.Schema$CalendarResource[];
  users: oauth2_v2.Schema$Userinfo[];

  constructor() {
    this.events = [];
    this.rooms = [];
    this.users = [];
    this.seedRooms();
    this.seedUsers();
  }

  seedRooms() {
    // any changes would require a reset of the data from the database, since rooms are assigned first time a user with domain X signs in the app
    this.rooms.push(
      {
        resourceId: 'room102',
        resourceName: 'Cedar',
        resourceEmail: 'cedar.room@@resource.calendar.google.com',
        userVisibleDescription: 'A cozy room with wooden accents and a large display screen.',
        floorName: 'F1',
        capacity: 8,
      },
      {
        resourceId: 'room112',
        resourceName: 'Aurora',
        resourceEmail: 'aurora.room@@resource.calendar.google.com',
        userVisibleDescription: 'A high-tech room with smart lighting and advanced video conferencing equipment.',
        floorName: 'F1',
        capacity: 12,
      },
      {
        resourceId: 'room203',
        resourceName: 'Oasis',
        resourceEmail: 'oasis.room@@resource.calendar.google.com',
        userVisibleDescription: 'A relaxing room with plants and a calming atmosphere, ideal for creative sessions.',
        floorName: 'F2',
        capacity: 7,
      },
      {
        resourceId: 'room306',
        resourceName: 'Summit',
        resourceEmail: 'summit.room@@resource.calendar.google.com',
        userVisibleDescription: 'An executive boardroom with premium furnishings and a city skyline view.',
        floorName: 'F3',
        capacity: 18,
      },
      {
        resourceId: 'room207',
        resourceName: 'Cascade',
        resourceEmail: 'cascade.room@@resource.calendar.google.com',
        userVisibleDescription: 'A quiet room with comfortable seating and a large whiteboard for brainstorming.',
        floorName: 'F2',
        capacity: 6,
      },
      {
        resourceId: 'room307',
        resourceName: 'Zen Conference',
        resourceEmail: 'zen.room@@resource.calendar.google.com',
        userVisibleDescription: 'A minimalist room with natural lighting and a video wall for presentations.',
        floorName: 'F3',
        capacity: 10,
      },
      {
        resourceId: 'room108',
        resourceName: 'Galaxy',
        resourceEmail: 'galaxy.room@@resource.calendar.google.com',
        userVisibleDescription: 'A futuristic room with interactive displays and advanced connectivity options.',
        floorName: 'F1',
        capacity: 12,
      },
      {
        resourceId: 'room401',
        resourceName: 'Nebula Boardroom',
        resourceEmail: 'nebula.room@@resource.calendar.google.com',
        userVisibleDescription: 'A top-floor boardroom with a stunning view and high-end presentation tools.',
        floorName: 'F4',
        capacity: 20,
      },
    );
  }

  seedUsers() {
    this.users.push(
      {
        id: 'user001',
        email: 'john.doe@quickmeet.com',
        name: 'John Doe',
      },
      {
        id: 'user002',
        email: 'jane.smith@quickmeet.com',
        name: 'Jane Smith',
      },
      {
        id: 'user003',
        email: 'sam.lee@quickmeet.com',
        name: 'Sam Lee',
      },
    );
  }

  getUser(index: number) {
    return this.users.at(index);
  }

  getRooms() {
    return this.rooms;
  }

  getRoom(name: string) {
    return this.rooms.find((r) => r.resourceName === name);
  }

  createEvent(event: calendar_v3.Schema$Event) {
    const randomId = `event-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    this.events.push({ ...event, id: randomId });
    return event;
  }

  getEvent(eventId: string): calendar_v3.Schema$Event | undefined {
    return this.events.find((event) => event.id === eventId);
  }

  updateEvent(eventId: string, updatedEvent: Partial<calendar_v3.Schema$Event>): calendar_v3.Schema$Event | undefined {
    const eventIndex = this.events.findIndex((event) => event.id === eventId);
    if (eventIndex !== -1) {
      this.events[eventIndex] = {
        ...this.events[eventIndex],
        ...updatedEvent,
      };
      return this.events[eventIndex];
    }
    return undefined;
  }

  deleteEvent(eventId: string): boolean {
    const eventIndex = this.events.findIndex((event) => event.id === eventId);
    if (eventIndex !== -1) {
      this.events.splice(eventIndex, 1);
      return true;
    }
    return false;
  }

  listEvents(start?: string, end?: string, limit?: number): calendar_v3.Schema$Event[] {
    // TODO: add start and end time logic, making sure ongoing events are also accounted for with +- 15 mins offset
    return this.events;
  }
}
