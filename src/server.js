const express = require("express");
const ActivitypubExpress = require("activitypub-express");

class Server {
  constructor(client) {
    this.client = client;
  }

  async listen(domain, port) {
    const app = express();
    const routes = {
      actor: '/@:actor',
      object: '/o/:id',
      activity: '/s/:id',
      inbox: '/@:actor/inbox',
      outbox: '/@:actor/outbox',
      followers: '/@:actor/followers',
      following: '/@:actor/following',
      liked: '/@:actor/liked',
      collections: '/@:actor/c/:id',
      blocked: '/@:actor/blocked',
      rejections: '/@:actor/rejections',
      rejected: '/@:actor/rejected',
      shares: '/s/:id/shares',
      likes: '/s/:id/likes'
    }
    const apex = ActivitypubExpress({
      name: 'Apex Example',
      version: '1.0.0',
      domain: `${domain}`,
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
    // app.get('/.well-known/webfinger', apex.net.webfinger.get);
    app.get('/.well-known/webfinger', (req, res) => {
      throw new Error("hello world!");
    });
    app.get('/.well-known/nodeinfo', apex.net.nodeInfoLocation.get);
    app.get('/nodeinfo/:version', apex.net.nodeInfo.get);
    app.post('/proxy', apex.net.proxy.post);

    app.on('apex-outbox', async (msg) => {
      //if (msg.activity.type === 'Create') {
      // console.log(`Outbox: new ${msg.activity.type} from ${msg.actor}`)
      //}
    });

    app.on('apex-inbox', async (msg) => {
      const {actor, activity, recipient, object} = msg;

      // console.log(`Inbox: new ${activity.type} from ${JSON.stringify(actor.id)} to ${recipient.id}`);

      // Auto-accept follows
      if (activity.type == "Follow") {
	// console.log("hi");
	// console.log(recipient);
	const accept = await apex.buildActivity("Accept", recipient.id, actor.id, {
          object: activity.id
	});
	// console.log(accept);
	const {postTask: publishUpdatedFollowers} = await apex.acceptFollow(recipient, activity);
	await apex.addToOutbox(recipient, accept);
	return publishUpdatedFollowers();
      }
    });

    app.get("/", (req, resp) => {
      resp.send("hello world");
    });

    const that = this;
    
    app.get("/post", (req, resp) => {
      that.post("wow!");
      resp.send("Published!");
    });

    
    apex.store.db = this.client.db('DB_NAME');
    await apex.store.setup();
    
    this.apex = apex;
    this.domain = domain;
        
    // https://paul.kinlan.me/adding-activity-pub-to-your-static-site/
    
    this.server = app.listen(port);
  }

  async addUser(username, name, photo) {
    const actor = await this.apex.createActor(
      username,
      name,
      "Test user",
      photo,
      "Person"
    );
    await this.apex.store.saveObject(actor);
  }

  async post(username, content) {
    const note = await this.apex.buildActivity("Note", `https://${this.domain}/@${username}`, [this.apex.consts.publicAddress], {
      object: {
	content: content,
      }
      //  object: activity.object[0].id,
      // make sure sender can see it even if they don't follow yet
      // cc: actor.id
    });
    // console.log(share);
    const create = await this.apex.buildActivity("Create", `https://${this.domain}/@${username}`, [this.apex.consts.publicAddress], {
      object: note
      //  object: activity.object[0].id,
      // make sure sender can see it even if they don't follow yet
      // cc: actor.id
    });

    // console.log(create);

    const actor = await this.apex.store.getObject(`https://${this.domain}/@${username}`);
    this.apex.addToOutbox(actor, create);
  }

  close() {
    this.server.close();
  }
}

module.exports = {
  Server: Server
};
