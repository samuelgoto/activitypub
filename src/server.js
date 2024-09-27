const express = require("express");
const ActivitypubExpress = require("activitypub-express");

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

    app.get("/", (req, resp) => {
      resp.send("hello world");
    });

    apex.store.db = this.client.db('DB_NAME');
    await apex.store.setup();
    
    const actor = await apex.createActor("me", "John Doe", "", null, "Social");
    await apex.store.saveObject(actor);

    console.log(`listening to port ${port}.`);
    this.server = app.listen(port);
  }

  close() {
    this.server.close();
  }
}

module.exports = {
  Server: Server
};
