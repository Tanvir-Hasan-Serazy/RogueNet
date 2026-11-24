import { db } from "./src/core/db/client.ts";

const users = [
  { firstName: "Ava", lastName: "Morgan", username: "ava_morgan" },
  { firstName: "Noah", lastName: "Bennett", username: "noah_bennett" },
  { firstName: "Mia", lastName: "Reed", username: "mia_reed" },
  { firstName: "Liam", lastName: "Foster", username: "liam_foster" },
  { firstName: "Sofia", lastName: "Hayes", username: "sofia_hayes" },
  { firstName: "Ethan", lastName: "Cole", username: "ethan_cole" },
  { firstName: "Isla", lastName: "Brooks", username: "isla_brooks" },
  { firstName: "Lucas", lastName: "Price", username: "lucas_price" },
  { firstName: "Zoe", lastName: "Parker", username: "zoe_parker" },
  { firstName: "Leo", lastName: "Turner", username: "leo_turner" },
];

function shuffle(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

async function seed() {
  const now = new Date();
  const seededUsers = await Promise.all(
    users.map((user) => {
      const id = `seed-${user.username}`;
      const data = {
        id,
        name: `${user.firstName} ${user.lastName}`,
        firstName: user.firstName,
        lastName: user.lastName,
        email: `${user.username}@example.com`,
        emailVerified: false,
        username: user.username,
        createdAt: now,
        updatedAt: now,
      };

      return db.user.upsert({
        where: { username: user.username },
        create: data,
        update: data,
        select: { id: true, username: true },
      });
    }),
  );

  const userIds = seededUsers.map((user) => user.id);
  const followEdges = new Map();
  const shuffledUsers = shuffle(seededUsers);

  for (let index = 0; index < shuffledUsers.length; index += 1) {
    const follower = shuffledUsers[index];
    const following = shuffledUsers[(index + 1) % shuffledUsers.length];
    followEdges.set(`${follower.id}:${following.id}`, {
      followerId: follower.id,
      followingId: following.id,
    });
  }

  for (const follower of seededUsers) {
    for (const following of seededUsers) {
      if (follower.id !== following.id && Math.random() < 0.3) {
        followEdges.set(`${follower.id}:${following.id}`, {
          followerId: follower.id,
          followingId: following.id,
        });
      }
    }
  }

  await db.$transaction([
    db.follow.deleteMany({
      where: {
        followerId: { in: userIds },
        followingId: { in: userIds },
      },
    }),
    db.follow.createMany({
      data: [...followEdges.values()].map((edge) => ({
        ...edge,
        createdAt: new Date(),
      })),
    }),
  ]);

  const counts = await db.user.findMany({
    where: { id: { in: userIds } },
    select: {
      username: true,
      _count: { select: { followers: true, follows: true } },
    },
    orderBy: { username: "asc" },
  });

  console.log("Seeded 10 users with randomized follower/following counts:");
  for (const user of counts) {
    console.log(
      `@${user.username}: ${user._count.followers} followers, ${user._count.follows} following`,
    );
  }
}

seed()
  .catch((error) => {
    console.error("Failed to seed users:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
