const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const bodyParser = require('body-parser');
var util = require('util')

const configfile = require('./config');
const line = require('@line/bot-sdk');

const middleware = require('@line/bot-sdk').middleware
const JSONParseError = require('@line/bot-sdk').JSONParseError
const SignatureValidationFailed = require('@line/bot-sdk').SignatureValidationFailed

const config = {
  channelAccessToken: configfile.linechannelAccessToken,
  channelSecret: configfile.linechannelSecret
};

// create LINE SDK client
const client = new line.Client(config);

express()
  .use(express.static(path.join(__dirname, 'public')))
  .use(bodyParser.json())
  

  .post('/webhook/', (req, res) => {
    console.log(util.inspect(req));
    Promise
      .all(req.body.events.map(handleEvent))
      .then((result) => res.json(result))
      .catch((err) => {
        console.error(err);
        res.status(500).end();
      });
  })

  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))



  // event handler
function handleEvent(event) {
  // if (event.type !== 'message' || event.message.type !== 'text') {
  //   // ignore non-text-message event
  //   return Promise.resolve(null);
  // }

  // create a echoing text message
  //const echo = { type: 'text', text: event.message.text };

  // use reply API
  //return client.replyMessage(event.replyToken, echo);


  if (event.replyToken && event.replyToken.match(/^(.)\1*$/)) {
    return console.log("Test hook recieved: " + JSON.stringify(event.message));
  }

  switch (event.type) {
    case 'message':
      const message = event.message;
      switch (message.type) {
        case 'text':
          //return handleText(message, event.replyToken, event.source);
          // create a echoing text message
          const echo = { type: 'text', text: event.message.text };

          // use reply API
          return client.replyMessage(event.replyToken, echo);
        
        default:
          throw new Error(`Unknown message: ${JSON.stringify(message)}`);
      }    

    default:
      throw new Error(`Unknown event: ${JSON.stringify(event)}`);
  }

}

// function handleText(message, replyToken, source) {

// }



