const {Server} = require("./src/server.js");
const {MongoMemoryServer} = require("mongodb-memory-server");
const {MongoClient} = require("mongodb");

async function main() {
  const db = await MongoMemoryServer.create();
  const uri = db.getUri();

  const client = new MongoClient(uri);
  await client.connect();

  const server = new Server(client);
  const port = process.env.PORT || 8080;
  const domain = process.env.DOMAIN || "localhost";
  await server.listen(domain, port);
  console.log(`listening to ${port} on ${domain}.`);

  // Add a test user
  await server.addUser(
    "alice",
    "Alice",
    "https://pbs.twimg.com/profile_images/920758039325564928/vp0Px4kC_400x400.jpg"
  );

  await server.post("alice", "Hello World");
}

main();
