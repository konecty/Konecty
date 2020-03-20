import moment from 'moment';

app.post('/rest/rocketchat/livechat', function(req, res /*, next*/) {
  if (
    !req.headers['x-rocketchat-livechat-token'] ||
    !Namespace.RocketChat ||
    !Namespace.RocketChat.livechat ||
    req.headers['x-rocketchat-livechat-token'] !== Namespace.RocketChat.livechat.token
  ) {
    res.statusCode = 403;
    return res.end();
  }

  var hookData = req.body;
  var result;
  var ddd = Namespace.ddd;
  if (process.env.KONECTY_MODE !== 'production') {
    console.log('RocketChak Hook ' + moment().format('DD/MM/YYYY HH:mm:ss'), hookData.type);
    console.log('RocketChak Hook -> Visitor', JSON.stringify(hookData.visitor));
    console.log('RocketChak Hook -> Agent', JSON.stringify(hookData.agent));
    console.log('RocketChak Hook -> Message', JSON.stringify(hookData.messages));
  }
  switch (hookData.type) {
    case 'LivechatSession':
    case 'LivechatEdit':
      var contactProcess = {
        name: 'contact',
        data: {
          name: hookData.visitor.name || hookData.visitor.username
        }
      };

      var messageExtraFields = {};

      if (hookData.visitor) {
        if (hookData.visitor.name && hookData.visitor.name.match(/guest/i)) {
          contactProcess.options = {
            doNotOverwriteName: true
          };
        }

        if (!_.isEmpty(hookData.visitor.email)) {
          contactProcess.data.email = _.isArray(hookData.visitor.email)
            ? hookData.visitor.email[0].address
            : hookData.visitor.email;
        }

        if (!_.isEmpty(hookData.visitor.phone)) {
          var phoneTreatment = function(p) {
            var phone = s
              .trim(p)
              .replace(/[^0-9]/g, '')
              .replace(/^0+/g, '');
            if (phone.length <= 9 && phone.length >= 8) {
              phone = ddd + phone;
            }
            return phone;
          };

					var phone = [];

          if (_.isArray(hookData.visitor.phone)) {
						phone = hookData.visitor.phone.map(phone => phoneTreatment(phone.phoneNumber));
          } else {
						phone.push(phoneTreatment(hookData.visitor.phone));
          }
					contactProcess.data.phone = phone;
        }

        // Remove email if it is invalid
        // so it doesnt break the process/submit
        if (contactProcess.data.email != null && /^.+@.+\.[A-Za-z]{2,}(:?\.[A-Za-z]{2,})?$/.test(contactProcess.data.email) !== true) {
            contactProcess.data.email = null;
        }

        if (_.isEmpty(contactProcess.data.phone) && _.isEmpty(contactProcess.data.email)) {
          res.statusCode = 200;
          return res.end();
        }

        contactProcess.data.notes = '';

        if (!_.isEmpty(hookData.tags)) {
          contactProcess.data.notes += 'Tags: ' + hookData.tags.join(', ') + '\n';
        }

        if (!_.isEmpty(hookData.customFields) || !_.isEmpty(hookData.visitor.customFields)) {
          var customFields = _.extend(hookData.visitor.customFields || {}, hookData.customFields || {});
          for (var customField in customFields) {
            if (customFields.hasOwnProperty(customField) && !_.isEmpty(customFields[customField])) {
              switch (customField) {
                case 'campaign':
                  contactProcess.data.campaign = {
                    identifier: customFields[customField]
                  };
                  break;
                case 'channel':
                  contactProcess.data.channel = {
                    identifier: customFields[customField]
                  };
                  break;
                case 'medium':
                  contactProcess.data.medium = customFields[customField];
                  break;
                case 'referrerURL':
                  contactProcess.data.referrerURL = customFields[customField];
                  break;
                case 'source':
                  contactProcess.data.source = {
                    identifier: customFields[customField]
                  };
                  messageExtraFields['source'] = { identifier: customFields[customField] };
                  break;
                case 'development':
                  messageExtraFields['development'] = { _id: customFields[customField] };
                  break;
                case 'product':
                  messageExtraFields['product'] = { _id: customFields[customField] };
                  break;
                default:
                  contactProcess.data.notes += customField + ': ' + customFields[customField] + '\n';
              }
            }
          }
        }
      }

      contactProcess.data.user = {
        _id: hookData.agent._id
      };

			if (hookData.visitor.department) {
				contactProcess.data.queue = { _id: hookData.visitor.department };
			} else if (Namespace.RocketChat.livechat.queue) {
        contactProcess.data.queue = Namespace.RocketChat.livechat.queue;
      }

      if (!contactProcess.data.campaign && Namespace.RocketChat.livechat.campaign) {
        contactProcess.data.campaign = Namespace.RocketChat.livechat.campaign;
      }

      var opportunityData = {
        name: 'opportunity',
        data: {},
        map: {
          contact: 'contact'
        }
      };

      if (contactProcess.data.campaign) {
        opportunityData.data.campaign = contactProcess.data.campaign;
      }
      if (contactProcess.data.channel) {
        opportunityData.data.channel = contactProcess.data.channel;
      }
      if (contactProcess.data.medium) {
        opportunityData.data.medium = contactProcess.data.medium;
      }
      if (contactProcess.data.referrerURL) {
        opportunityData.data.referrerURL = contactProcess.data.referrerURL;
      }
      if (contactProcess.data.source) {
        opportunityData.data.source = contactProcess.data.source;
      }
			
			if (hookData.visitor.department) {
				opportunityData.data.queue = { _id: hookData.visitor.department };
			} else if (Namespace.RocketChat.livechat.queue) {
				opportunityData.data.queue = Namespace.RocketChat.livechat.queue;
			}

      var messages = '';
      if (hookData.messages) {
        hookData.messages.forEach(function(msg) {
          messages +=
            '<strong>' +
            msg.username +
            '</strong> (' +
            moment(msg.ts).format('DD/MM/YYYY HH:mm:ss') +
            '): ' +
            msg.msg +
            '<br><br>\n\n';
        });

        var messageData = {
          name: 'message',
          data: {
            status: 'Nova',
            priority: 'Média',
            type: 'Livechat',
            subject: 'Cópia de Livechat - Código ' + hookData.code,
            body: messages
          },
          map: {
            contact: 'contact',
            opportunity: 'opportunity'
          }
        };

        if (contactProcess.data.campaign) {
          messageData.data.campaign = contactProcess.data.campaign;
        }
        if (contactProcess.data.channel) {
          messageData.data.channel = contactProcess.data.channel;
        }
        if (contactProcess.data.medium) {
          messageData.data.medium = contactProcess.data.medium;
        }

        Object.keys(messageExtraFields).forEach(function(key) {
          messageData.data[key] = messageExtraFields[key];
        });
      }

      if (hookData.crmData) {
        Object.keys(hookData.crmData).forEach(function(key) {
          if (key === 'contact') {
            if (hookData.crmData[key]._id) {
              contactProcess.data._id = hookData.crmData[key]._id;
            }
            if (hookData.crmData[key].code) {
              contactProcess.data.code = hookData.crmData[key].code;
            }
          } else if (key === 'opportunity') {
            if (hookData.crmData[key]._id) {
              opportunityData.data._id = hookData.crmData[key]._id;
            }
            if (hookData.crmData[key].code) {
              opportunityData.data.code = hookData.crmData[key].code;
            }
          } else if (key === 'message') {
            if (hookData.crmData[key]._id) {
              messageData.data._id = hookData.crmData[key]._id;
            }
            if (hookData.crmData[key].code) {
              messageData.data.code = hookData.crmData[key].code;
            }
          }
        });
      }

      var activity = {
        name: 'activity',
        data: {
          status: 'Concluída',
          subject: 'Chat',
          priority: 'Média',
          type: 'Contato'
        },
        map: {
          opportunity: 'opportunity',
          contact: 'contact'
        }
      };

			if (contactProcess.data.campaign.identifier) {
				contactProcess.data.campaign._id = contactProcess.data.campaign.identifier;
			};

      var request = {
        authTokenId: Namespace.RocketChat.accessToken,
        data: [contactProcess, opportunityData, messageData, activity]
      };

      result = Meteor.call('process:submit', request);
      break;

    case 'LivechatOfflineMessage':
      var contactProcess = {
        name: 'contact',
        data: {
          name: hookData.visitor.name
        }
      };

      if (!_.isEmpty(hookData.visitor.email)) {
        contactProcess.data.email = hookData.visitor.email;
      }

      if (Namespace.RocketChat.livechat.queue) {
        contactProcess.data.queue = Namespace.RocketChat.livechat.queue;
      }

      if (!contactProcess.data.campaign && Namespace.RocketChat.livechat.campaign) {
        contactProcess.data.campaign = Namespace.RocketChat.livechat.campaign;
      }

      var opportunityData = {
        name: 'opportunity',
        data: {},
        map: {
          contact: 'contact'
        }
      };

      if (Namespace.RocketChat.livechat.queue) {
        opportunityData.data.queue = Namespace.RocketChat.livechat.queue;
      }

      var messageData = {
        name: 'message',
        data: {
          status: 'Nova',
          priority: 'Média',
          type: 'Formulário Web',
          subject: 'Formulário Livechat',
          body: hookData.message.replace(/([\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + '<br>' + '$2')
        },
        map: {
          contact: 'contact',
          opportunity: 'opportunity'
        }
      };

      var request = {
        authTokenId: Namespace.RocketChat.accessToken,
        data: [contactProcess, opportunityData, messageData]
      };

      if (Namespace.RocketChat.livechat.saveCampaignTarget && Namespace.RocketChat.livechat.campaign) {
        var campaignTargetData = {
          name: 'campaignTarget',
          document: 'CampaignTarget',
          data: {
            campaign: Namespace.RocketChat.livechat.campaign,
            status: 'Novo'
          },
          map: {
            contact: 'contact',
            opportunity: 'opportunity'
          }
        };

        request.data.push(campaignTargetData);
      }

      result = Meteor.call('process:submit', request);
      break;

    default:
      res.statusCode = 400;
      return res.end();
  }

  if (process.env.KONECTY_MODE !== 'production') {
    console.log('RocketChak result ' + moment().format('DD/MM/YYYY HH:mm:ss'), JSON.stringify(result));
  }

  var response = { success: result.success };

  if (result.success) {
    var processData = {};

    // get _id from all saved documents
    Object.keys(result.processData).forEach(function(key) {
      if (result.processData[key]._id) {
        processData[key] = _.pick(result.processData[key], '_id', 'code');
      }
    });

    response.data = processData;
  }

  return res.send(response);
});

app.get('/rest/rocketchat/livechat/queue', function(req, res /*, next*/) {
  if (
    !req.headers['x-rocketchat-secret-token'] ||
    !Namespace.RocketChat ||
    !Namespace.RocketChat.livechat ||
    req.headers['x-rocketchat-secret-token'] !== Namespace.RocketChat.livechat.token
  ) {
    res.statusCode = 403;
    return res.end();
  }

  let departmentId = req.params.query.departmentId;
  var queue;
  if (departmentId) {
    var queueQuery = {
      $or: [{ _id: departmentId }, { name: departmentId }]
    };

    queue = Models.Queue.findOne(queueQuery, { fields: { _id: 1, active: 1 } });
    if (queue) {
      departmentId = queue._id;
    } else {
      departmentId = null;
    }
    if (queue && !queue.active) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.send('{ "success": false, "error": "Queue not active" }');
    }
  }

  if (!departmentId && Namespace.RocketChat.livechat.queue) {
    departmentId = Namespace.RocketChat.livechat.queue;
  }

  if (!departmentId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.send('{ "success": false, "error": "Queue not found" }');
  }

  const nextAgent = Meteor.call('data:queue:next', {
    authTokenId: Namespace.RocketChat.accessToken,
    document: 'Queue',
    queueId: departmentId
  });

  if (nextAgent.success && nextAgent.user && nextAgent.user.user && nextAgent.user.user._id) {
    const user = Meteor.users.findOne(nextAgent.user.user._id, { fields: { username: 1 } });
    return res.send(user);
  }

  return res.send();
});
