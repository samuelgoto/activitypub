const express = require("express");
const {Server} = require("../src/server.js");

const {MongoMemoryServer} = require("mongodb-memory-server");
const {MongoClient} = require("mongodb");

const assert = require("assert");

describe("index", () => {
  it("basic", async () => {
    const db = await MongoMemoryServer.create();
    const uri = db.getUri();

    const client = new MongoClient(uri);
    await client.connect();

    const server = new Server(client);
    const port = 8080;
    await server.listen("localhost", port);

    const request = await fetch(`http://localhost:${port}/.well-known/webfinger?resource=acct:alice@localhost`);

    assertThat(request.ok).equalsTo(true);

    assertThat(await request.json()).equalsTo({
      "subject": "acct:alice@localhost",
      "links": [{
	"href": "https://localhost/alice",
	"rel": "self",
	"type": "application/activity+json"
      }]
    });

    const me = await fetch("http://localhost:8080/alice", {
      headers: {
	"Accept": "application/activity+json",
      }
    });
    assertThat(me.ok).equalsTo(true);

    const alice = await me.json();

    // console.log(alice.publicKey);
    
    delete alice.publicKey;
    assertThat(alice).equalsTo({
      "@context": [
        "https://www.w3.org/ns/activitystreams",
        "https://w3id.org/security/v1"
      ],
      id: "https://localhost/alice",
      type: "Social",
      inbox: "https://localhost/alice/inbox",
      endpoints: {
        id: "https://localhost/alice#endpoints",
        proxyUrl: "https://localhost/proxy"
      },
      followers: "https://localhost/alice/followers",
      following: "https://localhost/alice/following",
      liked: "https://localhost/alice/liked",
      name: "Alice",
      outbox: "https://localhost/alice/outbox",
      preferredUsername: "alice",
      summary: ""
    });
    
    const {inbox} = alice;
    assertThat(inbox).equalsTo("https://localhost/alice/inbox");

    const bob = express();

    bob.get("*", (req, res) => {
      assertThat(req.headers.accept).equalsTo("application/activity+json");
      assertThat(req.url).equalsTo("/users/bob");
      res.send({
	"@context": [
          "https://www.w3.org/ns/activitystreams",
	  "https://w3id.org/security/v1"
	],
	id: "https://localhost:3000/users/bob",
	type: "Social",
	inbox: "https://localhost:3000/users/bob/inbox",
	endpoints: {
	  id: "https://localhost:3000/users/bob#endpoints",
          proxyUrl: "https://localhost/proxy"
	},
	followers: "https://localhost:3000/users/bob/followers",
	following: "https://localhost:3000/users/bob/following",
	liked: "https://localhost:3000/users/bob/liked",
	name: "Bob",
	outbox: "https://localhost:3000/users/bob/outbox",
	preferredUsername: "bob",
	summary: ""
      });
    });
    bob.post("*", (req, res) => {
      assertThat(true).equalsTo(false);
    });
    const b = await bob.listen(3000);

    const follow = await fetch("http://localhost:8080/alice/inbox", {
      method: "POST",
      headers: {
	"Content-Type": "application/activity+json"
      },
      body: JSON.stringify({
	"@context": "https://www.w3.org/ns/activitystreams",
	"id": "1234",
	"type": "Follow",
	"actor": "http://localhost:3000/users/bob",
	"object": "https://localhost/alice"
      })
    });

    assertThat(follow.ok).equalsTo(true);

    assertThat((await (await fetch("http://localhost:8080/alice/followers", {
      headers: {
	"Accept": "application/activity+json",
      }
    })).json()).totalItems).equalsTo(0);
    
    await b.close();

    await server.close();
    
    await client.close();
    
    await db.stop();
  });
});


function assertThat(x) {
  return {
    equalsTo(y) {
      assert.deepEqual(x, y);
    }
  }
}
