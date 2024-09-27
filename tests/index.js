const express = require("express");
const {MongoMemoryServer} = require("mongodb-memory-server");
const ActivitypubExpress = require("activitypub-express");
const {MongoClient} = require("mongodb");
const assert = require("assert");


class Server {
  constructor(client) {
    this.client = client;
  }

  async listen(port) {
    const app = express();
    const routes = {
      actor: '/u/:actor',
      object: '/o/:id',
      activity: '/s/:id',
      inbox: '/u/:actor/inbox',
      outbox: '/u/:actor/outbox',
      followers: '/u/:actor/followers',
      following: '/u/:actor/following',
      liked: '/u/:actor/liked',
      collections: '/u/:actor/c/:id',
      blocked: '/u/:actor/blocked',
      rejections: '/u/:actor/rejections',
      rejected: '/u/:actor/rejected',
      shares: '/s/:id/shares',
      likes: '/s/:id/likes'
    }
    const apex = ActivitypubExpress({
      name: 'Apex Example',
      version: '1.0.0',
      domain: `localhost:${port}`,
      actorParam: 'actor',
      objectParam: 'id',
      activityParam: 'id',
      routes,
      endpoints: {
	proxyUrl: 'https://localhost/proxy'
      }
    });
    
    app.use(
      express.json({ type: apex.consts.jsonldTypes }),
      express.urlencoded({ extended: true }),
      apex
    );
    // define routes using prepacakged middleware collections
    app.route(routes.inbox)
      .get(apex.net.inbox.get)
      .post(apex.net.inbox.post);
    app.route(routes.outbox)
      .get(apex.net.outbox.get)
      .post(apex.net.outbox.post);
    app.get(routes.actor, apex.net.actor.get);
    app.get(routes.followers, apex.net.followers.get);
    app.get(routes.following, apex.net.following.get);
    app.get(routes.liked, apex.net.liked.get);
    app.get(routes.object, apex.net.object.get);
    app.get(routes.activity, apex.net.activityStream.get);
    app.get(routes.shares, apex.net.shares.get);
    app.get(routes.likes, apex.net.likes.get);
    app.get('/.well-known/webfinger', apex.net.webfinger.get);
    app.get('/.well-known/nodeinfo', apex.net.nodeInfoLocation.get);
    app.get('/nodeinfo/:version', apex.net.nodeInfo.get);
    app.post('/proxy', apex.net.proxy.post);

    apex.store.db = this.client.db('DB_NAME');
    await apex.store.setup();
    
    const actor = await apex.createActor("me", "John Doe", "", null, "Social");
    await apex.store.saveObject(actor);

    this.server = app.listen(port);
  }

  close() {
    this.server.close();
  }
}

describe("index", () => {
  it("basic", async () => {
    const db = await MongoMemoryServer.create();
    const uri = db.getUri();

    const client = new MongoClient(uri);
    await client.connect();

    const server = new Server(client);
    const port = 8080;
    await server.listen(port);

    const request = await fetch(`http://localhost:${port}/.well-known/webfinger?resource=acct:me@localhost:${port}`);

    assertThat(request.ok).equalsTo(true);

    assertThat(await request.json()).equalsTo({
      "subject": "acct:me@localhost:8080",
      "links": [{
	"href": "https://localhost:8080/u/me",
	"rel": "self",
	"type": "application/activity+json"
      }]
    });

    const me = await fetch("http://localhost:8080/u/me", {
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
      id: "https://localhost:8080/u/me",
      type: "Social",
      inbox: "https://localhost:8080/u/me/inbox",
      endpoints: {
        id: "https://localhost:8080/u/me#endpoints",
        proxyUrl: "https://localhost/proxy"
      },
      followers: "https://localhost:8080/u/me/followers",
      following: "https://localhost:8080/u/me/following",
      liked: "https://localhost:8080/u/me/liked",
      name: "John Doe",
      outbox: "https://localhost:8080/u/me/outbox",
      preferredUsername: "me",
      summary: ""
    });
    
    const {inbox} = alice;
    assertThat(inbox).equalsTo("https://localhost:8080/u/me/inbox");

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

    const follow = await fetch("http://localhost:8080/u/me/inbox", {
      method: "POST",
      headers: {
	"Content-Type": "application/activity+json"
      },
      body: JSON.stringify({
	"@context": "https://www.w3.org/ns/activitystreams",
	"id": "1234",
	"type": "Follow",
	"actor": "http://localhost:3000/users/bob",
	"object": "https://localhost:8080/u/me"
      })
    });

    assertThat(follow.ok).equalsTo(true);

    assertThat((await (await fetch("http://localhost:8080/u/me/followers", {
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
