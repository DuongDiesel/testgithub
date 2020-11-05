const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const bodyParser = require('body-parser');

const pg = require('pg');

const uuid = require('uuid');

const configfile = require('./config');
const line = require('@line/bot-sdk');

const dialogflow = require('dialogflow');

//B
pg.defaults.ssl = true;

const config = {
  channelAccessToken: configfile.linechannelAccessToken,
  channelSecret: configfile.linechannelSecret
};

// create LINE SDK client
const client = new line.Client(config);

const credentials = {
  client_email: configfile.GOOGLE_CLIENT_EMAIL,
  private_key: configfile.GOOGLE_PRIVATE_KEY
};

const sessionClient = new dialogflow.SessionsClient(
  {
      projectId: configfile.GOOGLE_PROJECT_ID,
      credentials
  }
);
const sessionIds = new Map();

express()
  .use(express.static(path.join(__dirname, 'public')))
  .use(bodyParser.json())
  


  .post('/webhook/', (req, res) => {
    
    try {
      req.body.events.map(handleEvent)
      
    } catch (err) {
      console.error(err);
        res.status(500).end();
    }      
  })

  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))



  // event handler
function handleEvent(event) {
  
  if (event.replyToken && event.replyToken.match(/^(.)\1*$/)) {
    return console.log("Test hook recieved: " + JSON.stringify(event.message));
  }

  switch (event.type) {
    case 'message':
      const message = event.message;
      switch (message.type) {
        case 'text':


          //return handleText(message, event.replyToken, event.source);
          var senderID = event.source.userId;
          
          var timeOfMessage = event.timestamp;

          if (!sessionIds.has(senderID)) { 
            // kiểm tra xem trong cái sessionIds (là 1 map) xem là có senderID hay không.tác dụng hàm has.dấu ! tức là nếu ko có senderID
           sessionIds.set(senderID, uuid.v1());   // thì tạo 1 set mới
           }
          
          var messageText = message.text;
          if (messageText) {
            //send message to api.ai @@ gửi nó đến DialogFlow
            sendToDialogFlow(senderID, messageText,event.replyToken,timeOfMessage); 
          }          
         break;

         case 'location':
          var senderID = event.source.userId;
          
          var timeOfMessage = event.timestamp;

          if (!sessionIds.has(senderID)) { 
            // kiểm tra xem trong cái sessionIds (là 1 map) xem là có senderID hay không.tác dụng hàm has.dấu ! tức là nếu ko có senderID
           sessionIds.set(senderID, uuid.v1());   // thì tạo 1 set mới
           }
          //var messageText = message.address;//lay dia chi
          var lat= message.latitude.toString();
          var long = message.longitude.toString();
          
          var messageText = lat+','+long;//lay kinh do vi do
          //console.log(messageText);
          sendToDialogFlow(senderID, messageText,event.replyToken,timeOfMessage); 
          
          
          break; 

        default:
          throw new Error(`Unknown message: ${JSON.stringify(message)}`);
      }
      break;    
    
    
      
    default:
      throw new Error(`Unknown event: ${JSON.stringify(event)}`);
  }

}



async function sendToDialogFlow(sender, textString, replyToken,timeOfMessage, params) {  

  

  try { //try này giúp dialogFlow theo dõi cụ thể ng dùng trong cái sesion đó
      const sessionPath = sessionClient.sessionPath(
          configfile.GOOGLE_PROJECT_ID,
          sessionIds.get(sender)
      );

      // gửi văn bản tới dialogflow
      const request = {
          session: sessionPath,
          queryInput: {
              text: {
                  text: textString,
                  languageCode: configfile.DF_LANGUAGE_CODE,
              },
          },
          queryParams: {
              payload: {
                  data: params
              }
          }
      };

      // khi có phản hồi từ dialogflow thì ta xử lí nó
      
      const responses = await sessionClient.detectIntent(request);
      
      const result = responses[0].queryResult;
      //console.log('result.fulfillmentMessages is');
      //console.log(result.fulfillmentMessages);
      handleDialogFlowResponse(sender, result, replyToken,timeOfMessage);
      
      console.log(' entered sendToDialogFlow')
  } catch (e) {
      console.log('error');
      console.log(e);
  }

}

function handleDialogFlowResponse(sender, response, replyToken,timeOfMessage) {
  // phân tích cái mà dialogFlow gửi về
  
  let responseText = response.fulfillmentMessages.fulfillmentText;

  let messages = response.fulfillmentMessages;
  let action = response.action;
  let contexts = response.outputContexts;
  let parameters = response.parameters;
  
  if (isDefined(action)) {
      handleDialogFlowAction(sender, action, messages, contexts, parameters, replyToken,timeOfMessage);
      console.log('handleDialogFlowResponse defined action'); 
  } else if (isDefined(messages)) {
      handleMessages(messages, replyToken);//////////////////////////////////////
      console.log('handleDialogFlowResponse defined messages-if not setting action on DF');
      
  } 
}

function handleDialogFlowAction(sender, action, messages, contexts, parameters,replyToken, timeOfMessage) {
  switch (action) {    

    case 'start':
      console.log('entered start');
      start(sender);
      handleMessages( messages,replyToken);    
      break;

    case 'sub2':       

      console.log('entered sub2')
      let filteredContextsSub2 = contexts.filter(function (el){ //Phương thức filter() dùng để tạo một mảng mới với tất cả các phần tử thỏa điều kiện của một hàm test.
        return el.name.includes('isubmit_userinfo-yes-followup') //name of contexts......ten cua cai context luu cac gia tri.
      });
      if (filteredContextsSub2.length > 0 && contexts[0].parameters){

        let username = (contexts[0].parameters.fields['username']) && contexts[0].parameters.fields['username'] !='' ? contexts[0].parameters.fields["username"].stringValue : '';        
        let userID = (contexts[0].parameters.fields['userID']) && contexts[0].parameters.fields['userID'] !='' ? contexts[0].parameters.fields["userID"].stringValue : '';
        let userAdd = (contexts[0].parameters.fields['userAdd']) && contexts[0].parameters.fields['userAdd'] !='' ? contexts[0].parameters.fields["userAdd"].stringValue : '';        
        
        if (username !== '' && userID !== '' && userAdd !== '') {
          console.log('entered sub2 if1');
          //handleMessages( messages,replyToken);
          //send button
          sendButtonMessageSub2(replyToken,messages);

        }else{
          console.log('entered sub2 if2')
          handleMessages( messages,replyToken);
        }
          
      }else{
        console.log('entered sub2 if3');
        handleMessages( messages,replyToken);
      }
      
    break;
    
    
    case 'sub3':
      console.log('entered sub3')
      let filteredContextsSub3 = contexts.filter(function (el){ //Phương thức filter() dùng để tạo một mảng mới với tất cả các phần tử thỏa điều kiện của một hàm test.
        return el.name.includes('isubmit_userinfo-yes-followup') //name of contexts......ten cua cai context luu cac gia tri.
      });
      if (filteredContextsSub3.length > 0 && contexts[0].parameters){

        let username = (contexts[0].parameters.fields['username']) && contexts[0].parameters.fields['username'] !='' ? contexts[0].parameters.fields["username"].stringValue : '';        
        let userID = (contexts[0].parameters.fields['userID']) && contexts[0].parameters.fields['userID'] !='' ? contexts[0].parameters.fields["userID"].stringValue : '';
        let userAdd = (contexts[0].parameters.fields['userAdd']) && contexts[0].parameters.fields['userAdd'] !='' ? contexts[0].parameters.fields["userAdd"].stringValue : '';        
        
        let senddataSub3 = {
          username:username,          
          userID:userID,
          userAdd:userAdd,
          time_update:timeOfMessage          
        };

        updateInfoUser(sender,senddataSub3);
        handleMessages( messages,replyToken);     
      }
    break;

    case 'safe1':
      console.log('entered safe1');
      sendButtonOk(replyToken,messages);
    break;

    case 'safe2':       

      console.log('entered safe2');
      let filteredContextsSafe2 = contexts.filter(function (el){ //Phương thức filter() dùng để tạo một mảng mới với tất cả các phần tử thỏa điều kiện của một hàm test.
        return el.name.includes('submit_safe-custom-followup') //name of contexts......ten cua cai context luu cac gia tri.
      });
      if (filteredContextsSafe2.length > 0 && contexts[0].parameters){
        console.log('entered safe2 1:: sent confirm button');
        let issafe = (contexts[0].parameters.fields['issafe']) && contexts[0].parameters.fields['issafe'] !='' ? contexts[0].parameters.fields["issafe"].stringValue : '';        
        let safelocation = (contexts[0].parameters.fields['safelocation']) && contexts[0].parameters.fields['safelocation'] !='' ? contexts[0].parameters.fields["safelocation"].stringValue : '';
        let safemess = (contexts[0].parameters.fields['safemess']) && contexts[0].parameters.fields['safemess'] !='' ? contexts[0].parameters.fields["safemess"].stringValue : '';        
        if (issafe != '' && safelocation != '' && safemess != '') {
          console.log('entered safe2 1.1');
          console.log(filteredContextsSafe2.length);
          //console.log(messages[messages.length - 1]);
          //handleMessages( messages,replyToken);
          //send button
          console.log("test");
          sendButtonMessageSub2(replyToken,messages);

        }else{
          console.log('entered safe2 1.2::dont know whether to need it or not');
          handleMessages( messages,replyToken);
        }

      }else if (contexts[0].parameters.fields['issafe'].stringValue =='' &&contexts[0].parameters.fields['safelocation'].stringValue =='' &&contexts[0].parameters.fields['safemess'].stringValue =='' &&contexts[0].parameters.fields['location'].stringValue =='' ){
        console.log('entered safe2 2::sent safe or not button');
        sendButtonMessageSafe(replyToken,messages);
      }else if (contexts[0].parameters.fields['issafe'].stringValue !='' &&contexts[0].parameters.fields['safelocation'].stringValue =='' &&contexts[0].parameters.fields['safemess'].stringValue =='' &&contexts[0].parameters.fields['location'].stringValue =='' ){
        console.log('entered safe2 2::sent home or school button');
        sendButtonMessageHomeSchool(replyToken,messages);
      }else if (contexts[0].parameters.fields['issafe'].stringValue !='' &&contexts[0].parameters.fields['safelocation'].stringValue !='' &&contexts[0].parameters.fields['safemess'].stringValue =='' &&contexts[0].parameters.fields['location'].stringValue =='' ){
        console.log('entered safe2 3::sent location button');
        //handleMessages( messages,replyToken);
        sendButtonGetLocation(replyToken,messages);//xu li cai mess nay
      }else{

        //console.log('entered safe2 4::show what we got');
        //console.log(contexts[0].parameters.fields['issafe'].stringValue);
        //console.log(contexts[0].parameters.fields['safelocation'].stringValue);
        //console.log(contexts[0].parameters.fields['safemess']);
        //console.log(contexts[0].parameters.fields['location']);

        handleMessages( messages,replyToken);
      }
      
    break;

    case 'safe3':
      console.log('entered safe3')
      let filteredContextsSafe3 = contexts.filter(function (el){ //Phương thức filter() dùng để tạo một mảng mới với tất cả các phần tử thỏa điều kiện của một hàm test.
        return el.name.includes('submit_safe-custom-followup') //name of contexts......ten cua cai context luu cac gia tri.
      });
      if (filteredContextsSafe3.length > 0 && contexts[0].parameters){

        let issafe = (contexts[0].parameters.fields['issafe']) && contexts[0].parameters.fields['issafe'] !='' ? contexts[0].parameters.fields["issafe"].stringValue : '';        
        let safelocation = (contexts[0].parameters.fields['safelocation']) && contexts[0].parameters.fields['safelocation'] !='' ? contexts[0].parameters.fields["safelocation"].stringValue : '';
        let safemess = (contexts[0].parameters.fields['safemess']) && contexts[0].parameters.fields['safemess'] !='' ? contexts[0].parameters.fields["safemess"].stringValue : '';
        let location = (contexts[0].parameters.fields['location']) && contexts[0].parameters.fields['location'] !='' ? contexts[0].parameters.fields["location"].stringValue : '';        
        let senddataSafe3 = {
          issafe:issafe,          
          safelocation:safelocation,
          safemess:safemess,
          location:location,

          time_update:timeOfMessage                    
        };
        updateInfoSafe(sender,senddataSafe3);
        handleMessages( messages,replyToken);        
      }
    break;

    case 'temp1':
      console.log('entered temp1');
      sendButtonOk(replyToken,messages);
    break;
      
    case 'temp2':       

      console.log('entered temp２');
      let filteredContextsTemp2 = contexts.filter(function (el){ //Phương thức filter() dùng để tạo một mảng mới với tất cả các phần tử thỏa điều kiện của một hàm test.
        return el.name.includes('isubmit_bodytemp-custom-followup') //name of contexts......ten cua cai context luu cac gia tri.
      });
      if (filteredContextsTemp2.length > 0 && contexts[0].parameters){

        let bodytemperature2 = (contexts[0].parameters.fields['bodytemperature']) && contexts[0].parameters.fields['bodytemperature'] !='' ? contexts[0].parameters.fields["bodytemperature"].stringValue : '';        
        
        if(bodytemperature2 !== ''){
          console.log('entered temp２ if1')
          //handleMessages( messages,replyToken);
          //send button
          sendButtonMessage(replyToken,messages);

        }else{
          console.log('entered temp２ if2')
          handleMessages( messages,replyToken);
        }
          
      }else{
        console.log('entered temp２ if3')
        handleMessages( messages,replyToken);
      }
      
    break;

    case 'temp3':
      console.log('entered temp3')
      let filteredContextsTemp3 = contexts.filter(function (el){ //Phương thức filter() dùng để tạo một mảng mới với tất cả các phần tử thỏa điều kiện của một hàm test.
        return el.name.includes('isubmit_bodytemp-custom-followup') //name of contexts......ten cua cai context luu cac gia tri.
      });
      if (filteredContextsTemp3.length > 0 && contexts[0].parameters){

        let bodytemperature3 = (contexts[0].parameters.fields['bodytemperature']) && contexts[0].parameters.fields['bodytemperature'] !='' ? contexts[0].parameters.fields["bodytemperature"].stringValue : '';        
        
        let senddataTemp3 = {
          bodytemperature:bodytemperature3,            
          temp_time:timeOfMessage                    
        };

        updateInfoTemp(sender,senddataTemp3);
        handleMessages( messages,replyToken);        
      }
    break;

    case 'comment1':
            console.log('entered temp3');
            sendButtonOk(replyToken,messages);

    break;

    case 'comment3':
      console.log('entered comment3')
      let filteredContextsComment3 = contexts.filter(function (el){ //Phương thức filter() dùng để tạo một mảng mới với tất cả các phần tử thỏa điều kiện của một hàm test.
        return el.name.includes('isubmit_comment-custom-followup') //name of contexts......ten cua cai context luu cac gia tri.
      });
      if (filteredContextsComment3.length > 0 && contexts[0].parameters){

        let comment3 = (contexts[0].parameters.fields['line_comment']) && contexts[0].parameters.fields['line_comment'] !='' ? contexts[0].parameters.fields["line_comment"].stringValue : '';        
        
        let senddataComment3 = {
          comment3:comment3,            
          temp_time:timeOfMessage                    
        };

        updateInfoComment(sender,senddataComment3);
        handleMessages( messages,replyToken);        
      }
    break;

    default:
      console.log('entered handleDialogFlowAction default case');
      console.log(replyToken);   
      //console.log(JSON.stringify(messages));       
      handleMessages( messages,replyToken);
    
  }  
}


function handleMessages(messages, sender) {
  
  let timeoutInterval = 1100;  
  let timeout = 0;
  for (var i = 0; i < messages.length; i++) {

    if(i == messages.length - 1)  {
        
        timeout = i * timeoutInterval;
        setTimeout(handleMessage.bind(null, messages[i], sender), timeout);
        console.log('entered handleMessages');
    }      
  }
}

function handleMessage(message, token) {
    switch (message.message) {
        case "text": //text
            console.log("entered handleMessage case text");
            
            message.text.text.forEach((text) => {
                if (text !== '') {
                    sendTextMessage(token, text);
                    //console.log(text);
                }
            });
            break;        
    }
}

function sendTextMessage(token, texts) {
  texts = Array.isArray(texts) ? texts : [texts];

  //console.log("replyMessage to user ");
  return client.replyMessage(
    token,
    texts.map((text) => ({ type: 'text', text }))
  );
}

function sendButtonMessage(token,messages) {
  
  console.log("sent confirm button ");
  //console.log(messages);
  //console.log(messages[messages.length - 1]);
  console.log(messages[messages.length - 1].quickReplies.title);  
  return client.replyMessage(
    token,
    {
      type: 'template',
      altText: 'Buttons alt text',
      template: {
        type: 'buttons',
        
        title: 'ご確認下さい',
        text: messages[messages.length - 1].quickReplies.title,
        actions: [
          
          { label: '確認', type: 'message', text: '確認' },
          { label: 'やり直し', type: 'message', text: 'やり直し' }
        ],
      },
    }
  );
}

function sendButtonMessageSub2(token,messages) {
  
  console.log("sent ButtonMessageSub2 ");
  //console.log(messages);
  //console.log(messages[messages.length - 1]);
  console.log(messages[messages.length - 1].text.text[0].length);  
  return client.replyMessage(
    token,
    {
      type: 'template',
      altText: 'Buttons alt text',
      template: {
        type: 'buttons',
        
        title: '入力した情報を確認してください。',
        text: messages[messages.length - 1].text.text[0],
        actions: [
          
          { label: '確認', type: 'message', text: '確認' },
          { label: 'やり直し', type: 'message', text: 'やり直し' }
        ],
      },
    }
  );
}

function sendButtonMessageSafe(token,messages) {
  
  console.log("sent safe or not button");
  
  return client.replyMessage(
    token,

    {
      "type": "text", // ①
      "text": messages[messages.length - 1].text.text[0],
      "quickReply": { // ②
        "items": [
          {
            "type": "action", // ③
            "action": {
              "type": "message",
              "label": "安全",
              "text": "Safe"
            }
          },
          {
            "type": "action",
            "action": {
              "type": "message",
              "label": "安全ではない",
              "text": "Not Safe"
            }
          }
        ]
      }
    }

  );
}

function sendButtonMessageHomeSchool(token,messages) {
  
  console.log("sent safe or not button");
  
  return client.replyMessage(
    token,

    {
      "type": "text", // ①
      "text": messages[messages.length - 1].text.text[0],
      "quickReply": { // ②
        "items": [
          {
            "type": "action", // ③
            "action": {
              "type": "message",
              "label": "家",
              "text": "家"
            }
          },
          {
            "type": "action",
            "action": {
              "type": "message",
              "label": "キャンパス",
              "text": "キャンパス"
            }
          },
          {
            "type": "action",
            "action": {
              "type": "message",
              "label": "その他",
              "text": "その他"
            }
          }
        ]
      }
    }

  );
}

function sendButtonGetLocation(token,messages) {
  
  console.log("sent get location button");
  
  return client.replyMessage(
    token,

    {
      "type": "text", // ①
      "text": messages[messages.length - 1].text.text[0],
      "quickReply": { // ②
        "items": [
          {
            "type": "action", // ③
            "action": {
              "type": "location",
              "label": "Send location"
            }
          },
          {
            "type": "action",
            "action": {
              "type": "message",
              "label": "Dont send",
              "text": "no"
            }
          }
        ]
      }
    }

  );
}

function sendButtonOk(token,messages) {
  
  console.log("sent ok button");
  
  return client.replyMessage(
    token,

    {
      "type": "text", // ①
      "text": messages[messages.length - 1].text.text[0],
      "quickReply": { // ②
        "items": [
          {
            "type": "action", // ③
            "action": {
              "type": "message",
              "label": "Ok",
              "text": "Ok"
            }
          },
          {
            "type": "action",
            "action": {
              "type": "message",
              "label": "間違う",
              "text": "間違う"
            }
          }
        ]
      }
    }

  );
}


function start(userId, replyToken){
  client.getProfile(userId)
  .then((profile) => {
    //console.log(profile.displayName);
    console.log(profile.userId);
    //console.log(profile.pictureUrl);
    //console.log(profile.statusMessage);
    
    if (profile.displayName) {
          
      var pool = new pg.Pool(configfile.PG_CONFIG);
      pool.connect(function(err, client, done) {
          if (err) {
              return console.error('Error acquiring client', err.stack);
          }
          var rows = [];
          client.query(`SELECT line_userid FROM users_line WHERE line_userid='${userId}' LIMIT 1`,
              function(err, result) {
                  if (err) {
                      console.log('Query error: ' + err);
                  } else {
                      if (result.rows.length === 0) {
                          let sql = 'INSERT INTO users_line (line_userid, displayname, pictureurl, statusmessage) ' +
                              'VALUES ($1, $2, $3, $4)';
                          client.query(sql,
                              [
                                  userId,
                                  profile.displayName,
                                  profile.pictureUrl,
                                  profile.statusMessage,
                                  
                              ]);
                      }
                  }
              });
          
      });
      pool.end();
      
      //sendTextMessage(replyToken,"da xong");
      
    } 
  })
  .catch((err) => {
    
  });

}

function updateInfoUser(line_id,senddata) {
  console.log('entered updateUserinfo with line_id:');
  console.log(line_id);

  var pool = new pg.Pool(configfile.PG_CONFIG);
  pool.connect(function(err, client, done) {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    let sql = 'UPDATE public.users_line SET user_name=$1, user_id=$2, user_address=$3, time_update=$4 WHERE line_userid=$5';

    client.query(sql,
        [
          senddata.username,
          senddata.userID,
          senddata.userAdd, 
          senddata.time_update,
          line_id
        ]);

  });
  pool.end();  
	//tao 1 cai query lay gia tri cua ca cai cot vua in vao xong in gtri do ra mot bang khac de backup
}

function updateInfoSafe(line_id,senddata) {
  console.log('entered updateInfoSafe with line_id :');
  console.log(line_id);

  var pool = new pg.Pool(configfile.PG_CONFIG);
  pool.connect(function(err, client, done) {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
      let sql = 'INSERT INTO safe_check (line_id, is_safe, safe_location, safe_mess, time_update, location) ' + 'VALUES ($1, $2, $3, $4, $5, $6)';
                                  
    client.query(sql,
        [
          line_id,
          senddata.issafe,
          senddata.safelocation,
          senddata.safemess,
          senddata.time_update,          
          senddata.location,
        ]);

  });
  pool.end();  
	
}

function updateInfoTemp(line_id,senddata) {
  console.log('entered updateInfoTemp with line_id:');
  //console.log(line_id);

  var pool = new pg.Pool(configfile.PG_CONFIG);
  pool.connect(function(err, client, done) {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
      let sql = 'INSERT INTO temp_check (line_id, temp, temp_time) ' + 'VALUES ($1, $2, $3)';
                                  
    client.query(sql,
        [
          line_id,
          senddata.bodytemperature,
          senddata.temp_time
                    
        ]);

  });
  pool.end();  
	
}

function updateInfoComment(line_id,senddata) {
  console.log('entered updateInfoComment with line_id:');
  console.log(line_id);

  var pool = new pg.Pool(configfile.PG_CONFIG);
  pool.connect(function(err, client, done) {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
      let sql = 'INSERT INTO comment_line (line_id, comment, comment_time) ' + 'VALUES ($1, $2, $3)';
                                  
    client.query(sql,
        [
          line_id,
          senddata.comment3,
          senddata.temp_time
                    
        ]);

  });
  pool.end();  
	
}

function isDefined(obj) {
  if (typeof obj == 'undefined') {
      return false;
  }

  if (!obj) {
      return false;
  }

  return obj != null;
}