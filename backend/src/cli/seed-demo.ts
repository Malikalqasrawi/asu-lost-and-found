import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../app.module.js';
import { hashPassword } from '../auth/passwords.js';
import { ClaimsService } from '../claims/claims.service.js';
import type { Role } from '../generated/prisma/client.js';
import { DeskService } from '../handovers/desk.service.js';
import { MessagesService } from '../handovers/messages.service.js';
import { BansService } from '../moderation/bans.service.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { ReportsService } from '../moderation/reports.service.js';
import { PlacesService } from '../places/places.service.js';
import type { PostView } from '../posts/post-view.js';
import { PostsService } from '../posts/posts.service.js';
import { LOCAL_MAIL_HOSTS } from '../mail/smtp-mail-sender.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { demoPhoto, type DemoItem } from './demo-photos.js';

const PEOPLE = {
  lina: ['202110431@students.example.edu', 'Lina Haddad', 'STUDENT'],
  omar: ['202120587@students.example.edu', 'Omar Khalil', 'STUDENT'],
  sara: ['202130219@students.example.edu', 'Sara Nasser', 'STUDENT'],
  yazan: ['202140766@students.example.edu', 'Yazan Odeh', 'STUDENT'],
  rami: ['202150318@students.example.edu', 'Rami Saleh', 'STUDENT'],
  tariq: ['202160954@students.example.edu', 'Tariq Mansour', 'STUDENT'],
  desk: ['security.desk@example.edu', 'Security Office', 'SECURITY'],
  admin: ['mona.rashed@example.edu', 'Mona Rashed', 'ADMIN'],
} as const satisfies Record<string, readonly [string, string, Role]>;

type Person = keyof typeof PEOPLE;
type People = Record<Person, string>;
type NewPost = Parameters<PostsService['create']>[1];

interface Demo {
  app: INestApplicationContext;
  people: People;
  places: Map<string, string>;
}

function daysAgo(days: number): string {
  const day = new Date(Date.now() - days * 86_400_000);
  return day.toLocaleDateString('en-CA', { timeZone: 'Asia/Amman' });
}

async function createPeople(
  prisma: PrismaService,
  password: string,
): Promise<People> {
  const passwordHash = await hashPassword(password);
  const people = {} as People;
  for (const [key, [email, fullName, role]] of Object.entries(PEOPLE)) {
    const user = await prisma.user.create({
      data: {
        email,
        fullName,
        role,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    people[key as Person] = user.id;
  }
  return people;
}

async function post(
  demo: Demo,
  author: Person,
  item: DemoItem,
  fields: Omit<NewPost, 'placeId'> & { place: string },
): Promise<PostView> {
  const { place, ...rest } = fields;
  const placeId = demo.places.get(place);
  if (!placeId) {
    throw new Error(`No campus place called ${place}`);
  }
  return demo.app
    .get(PostsService)
    .create(demo.people[author], { ...rest, placeId }, [await demoPhoto(item)]);
}

/** Lina found Omar's wallet; he proved it is his and they are arranging the pickup. */
async function walletHandover(demo: Demo): Promise<void> {
  const { lina, omar } = demo.people;
  const wallet = await post(demo, 'lina', 'wallet', {
    type: 'FOUND',
    title: 'Black leather wallet',
    description: 'Found on a table on the second floor, next to the windows.',
    category: 'WALLET',
    place: 'Library',
    placeDetails: 'Second floor, quiet study area',
    happenedOn: daysAgo(1),
    questions: [
      'What is inside the front pocket?',
      'What colour is the card holder?',
    ],
    privateNotes:
      'A blue bank card holder and a cinema ticket in the front pocket.',
  });
  const claims = demo.app.get(ClaimsService);
  const form = await claims.claimForm(wallet.id, omar);
  const claim = await claims.create(wallet.id, omar, {
    answers: [
      { questionId: form.questions[0].id, answer: 'An old cinema ticket' },
      { questionId: form.questions[1].id, answer: 'Blue' },
    ],
    message: 'I lost it on Sunday while studying for my database exam.',
  });
  await claims.accept(claim.id, lina);

  const messages = demo.app.get(MessagesService);
  await messages.send(
    wallet.id,
    lina,
    'Hi Omar, your answers match. I am in the library until 2 pm.',
  );
  await messages.send(
    wallet.id,
    omar,
    'Thank you so much! Can we meet at the library entrance at 1?',
  );
  await messages.send(
    wallet.id,
    lina,
    'Sure, see you at 1. Bring your pickup code.',
  );
}

async function openPosts(demo: Demo): Promise<void> {
  await post(demo, 'sara', 'keys', {
    type: 'FOUND',
    title: 'Car keys with a blue keychain',
    category: 'KEYS',
    place: 'Faculty of Engineering',
    placeDetails: 'Ground floor, near lab 104',
    happenedOn: daysAgo(0),
    questions: ['What brand is the car?', 'What is written on the keychain?'],
    privateNotes: 'Hyundai key, the keychain says "Aqaba".',
  });
  await post(demo, 'yazan', 'earbuds', {
    type: 'LOST',
    title: 'White AirPods case',
    description: 'The case has a small scratch on the lid.',
    category: 'ELECTRONICS',
    place: 'Cafeteria',
    happenedOn: daysAgo(2),
  });
  await post(demo, 'sara', 'earbuds', {
    type: 'FOUND',
    title: 'AirPods Pro case',
    category: 'ELECTRONICS',
    place: 'Cafeteria',
    placeDetails: 'Table by the window',
    happenedOn: daysAgo(1),
    questions: ['Does the case have any marks on it?'],
  });
  await post(demo, 'omar', 'umbrella', {
    type: 'FOUND',
    title: 'Navy blue umbrella',
    category: 'OTHER',
    place: 'Main gate',
    happenedOn: daysAgo(3),
    questions: ['What does the handle look like?'],
  });
  await post(demo, 'lina', 'calculator', {
    type: 'LOST',
    title: 'Casio fx-991 calculator',
    description: 'My name is written on the back in marker.',
    category: 'ELECTRONICS',
    place: 'Faculty of Information Technology',
    happenedOn: daysAgo(4),
  });
  await post(demo, 'rami', 'backpack', {
    type: 'LOST',
    title: 'Grey backpack with a laptop sleeve',
    category: 'BAG',
    place: 'Parking',
    happenedOn: daysAgo(5),
  });
}

/** A bottle at the security desk, so the Desk tab has something on it. */
async function deskItem(demo: Demo): Promise<void> {
  const bottle = await post(demo, 'yazan', 'bottle', {
    type: 'FOUND',
    title: 'Steel water bottle',
    category: 'OTHER',
    place: 'Sports hall',
    happenedOn: daysAgo(2),
    questions: ['What colour is the band around it?'],
  });
  const desk = demo.app.get(DeskService);
  await desk.handIn(bottle.id, demo.people.yazan);
  await desk.receive(bottle.id, demo.people.desk);
}

/** Reports waiting for the admin, and decisions already in the activity log. */
async function moderation(demo: Demo): Promise<void> {
  const { admin, lina, sara, yazan, tariq } = demo.people;
  const reports = demo.app.get(ReportsService);
  const spam = await post(demo, 'rami', 'books', {
    type: 'FOUND',
    title: 'Selling used textbooks, cheap',
    description: 'All first-year books, message me for prices.',
    category: 'BOOKS',
    place: 'Somewhere else on campus',
    happenedOn: daysAgo(0),
    questions: ['Which books do you need?'],
  });
  await reports.reportPost(spam.id, yazan, {
    reason: 'SPAM',
    details: 'This is an advert, not a found item.',
  });
  await reports.reportPost(spam.id, sara, { reason: 'SPAM' });

  const fake = await post(demo, 'tariq', 'phone', {
    type: 'FOUND',
    title: 'iPhone 15, message me',
    category: 'PHONE',
    place: 'Mosque',
    happenedOn: daysAgo(1),
    questions: ['What is your phone number?'],
  });
  await reports.reportPost(fake.id, lina, {
    reason: 'FAKE',
    details: 'He asks everyone for their phone number.',
  });
  const moderation = demo.app.get(ModerationService);
  await moderation.hidePost(fake.id, admin);

  const notes = await post(demo, 'lina', 'books', {
    type: 'FOUND',
    title: 'Stack of lecture notes',
    category: 'BOOKS',
    place: 'Library',
    happenedOn: daysAgo(3),
    questions: ['Which course are the notes for?'],
  });
  await reports.reportPost(notes.id, tariq, { reason: 'OTHER' });
  await moderation.dismiss({ postId: notes.id }, admin);
  await demo.app.get(BansService).ban(tariq, admin, {
    reason: 'Fake found items used to collect phone numbers.',
    days: 14,
  });
}

async function main(): Promise<void> {
  const password = process.env.DEMO_PASSWORD ?? '';
  if (password.length < 16) {
    console.error('Set DEMO_PASSWORD (at least 16 characters) in .env first.');
    process.exitCode = 1;
    return;
  }
  // Demo accounts with a shared password belong on a local stack, never on a real server.
  if (!LOCAL_MAIL_HOSTS.includes((process.env.MAIL_HOST ?? '').toLowerCase())) {
    console.error(
      'The demo data only goes into a local stack that sends email to Mailpit.',
    );
    process.exitCode = 1;
    return;
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const prisma = app.get(PrismaService);
    if ((await prisma.user.count()) > 0) {
      throw new Error(
        'The database already has accounts. The demo data is for an empty local database.',
      );
    }
    const places = await app.get(PlacesService).list();
    const demo: Demo = {
      app,
      people: await createPeople(prisma, password),
      places: new Map(places.map(({ name, id }) => [name, id])),
    };
    // Newest last, so Browse opens on the everyday items.
    await moderation(demo);
    await deskItem(demo);
    await walletHandover(demo);
    await openPosts(demo);
    // The demo people have no real inboxes; drop what the story queued for them.
    const addresses = Object.values(PEOPLE).map(([email]) => email);
    await prisma.outboxEmail.deleteMany({
      where: { toAddress: { in: addresses } },
    });
    console.log('Demo data created. Every account uses DEMO_PASSWORD:');
    for (const [email, name, role] of Object.values(PEOPLE)) {
      console.log(`  ${email}  ${name} (${role})`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

await main();
