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
}

main();
