const _ = require('lodash');
const moment = require('moment');
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const router = express.Router({ mergeParams: true });
const marked = require('marked');
const api = require('../api');
const authHelper = require('../helpers/authentication');
const ltiCustomer = require('../helpers/ltiCustomer');
const request = require('request');

const createToolHandler = (req, res, next) => {
    const context = req.originalUrl.split('/')[1];
    api(req).post('/ltiTools/', {
        json: req.body
    }).then(tool => {
        if (tool._id) {
            api(req).patch(`/${context}/` + req.body.courseId, {
                json: {
                    $push: {
                        ltiToolIds: tool._id
                    }
                }
            }).then(course => {
            res.redirect(`/${context}/` + course._id);
            });
        }
    });
};

const addToolHandler = (req, res, next) => {
    const context = req.originalUrl.split('/')[1];
    let action = `/${context}/` + req.params.courseId + '/tools/add';

    api(req).get('/ltiTools', { qs: {isTemplate: true}})
    .then(tools => {
        api(req).get(`/${context}/` + req.params.courseId)
            .then(course => {
                res.render('courses/add-tool', {
                    action,
                    title: 'Tool anlegen für ' + course.name,
                    submitLabel: 'Tool anlegen',
                    ltiTools: tools.data,
                    courseId: req.params.courseId
                });
            });
    });
};

const generateNonce = (length) => {
	let text = "";
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for(let i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

const runToolHandler = (req, res, next) => {
    let currentUser = res.locals.currentUser;
    Promise.all([
    api(req).get('/ltiTools/' + req.params.ltiToolId),
    api(req).get('/roles/' + currentUser.roles[0]._id),
    api(req).get('/pseudonym?userId=' + currentUser._id + '&toolId=' + req.params.ltiToolId)
    ]).then(([tool, role, pseudonym]) => {
       let user_id = '';
       let formData = '';

       if (tool.privacy_permission === 'pseudonymous') {
         user_id = pseudonym.data[0].pseudonym;
       } else if (tool.privacy_permission === 'name' || tool.privacy_permission === 'e-mail') {
         user_id = currentUser._id;
       }

       const customer = new ltiCustomer.LTICustomer();
       if(tool.lti_version === 'LTI-1p0') {
		   const consumer = customer.createConsumer(tool.key, tool.secret);

		   let payload = {
			   lti_version: tool.lti_version,
			   lti_message_type: tool.lti_message_type,
			   resource_link_id: tool.resource_link_id || req.params.courseId,
			   roles: customer.mapSchulcloudRoleToLTIRole(role.name),
			   launch_presentation_document_target: 'window',
			   launch_presentation_locale: 'en',
			   lis_person_name_full: (tool.privacy_permission === 'name'
				   ? currentUser.displayName || `${currentUser.firstName} ${currentUser.lastName}`
				   : ''),
			   lis_person_contact_email_primary: (tool.privacy_permission === 'e-mail'
				   ? currentUser.email
				   : ''),
			   user_id
		   };
		   tool.customs.forEach((custom) => {
			   payload[customer.customFieldToString(custom)] = custom.value;
		   });

		   let request_data = {
			   url: tool.url,
			   method: 'POST',
			   data: payload
		   };

		   formData = consumer.authorize(request_data);
	   } else if (tool.lti_version='1.3.0') {
			const current = new Date();
			const iss = process.env.FRONTEND_URL || 'http://localhost:3100/';
			const id_token = {
				iss,
				aud: tool.oAuthClientId,
				sub: user_id,
				exp: current.getTime() + 3 * 60,
				iat: current.getTime(),
				nonce: generateNonce(16),
				"https://purl.imsglobal.org/spec/lti/claim/message_type": tool.lti_message_type,
				"https://purl.imsglobal.org/spec/lti/claim/roles": [
					"http://purl.imsglobal.org/vocab/lis/v2/membership#" + customer.mapSchulcloudRoleToLTIRole(role.name),
				],
				"https://purl.imsglobal.org/spec/lti/claim/resource_link": {
					"id": tool._id
				},
				"https://purl.imsglobal.org/spec/lti/claim/version": tool.lti_version,
				"https://purl.imsglobal.org/spec/lti/claim/deployment_id": tool._id,
				"https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings":
					(tool.lti_message_type === 'LtiDeepLinkingRequest'
						? {
							"accept_types": ["ltiLink"],
							"accept_media_types": "image/*,text/html",
							"accept_presentation_document_targets": ["iframe", "window"],
							"deep_link_return_url": `${iss}courses/x/tools/link/${tool._id}`,
						}
						: undefined),
			}
			formData = {
				id_token: jwt.sign(id_token, fs.readFileSync('private_key.pem'), {algorithm: 'RS256'})
			}
	   }

        res.render('courses/components/run-lti-frame', {
            url: tool.url,
            method: 'POST',
            formData: Object.keys(formData).map(key => {
                return {name: key, value: formData[key]};
            })
        });
    });
};

const getDetailHandler = (req, res, next) => {
    const context = req.originalUrl.split('/')[1];
    Promise.all([
        api(req).get(`/${context}/`, {
        qs: {
            teacherIds: res.locals.currentUser._id}
        }),
        api(req).get('/ltiTools/' + req.params.id)]).
    then(([courses, tool]) => {
        res.json({
            tool: tool
        });
    }).catch(err => {
        next(err);
    });
};

const showToolHandler = (req, res, next) => {
    const context = req.originalUrl.split('/')[1];

    Promise.all([
        api(req).get('/ltiTools/' + req.params.ltiToolId),
        api(req).get(`/${context}/` + req.params.courseId)
    ])
    .then(([tool, course]) => {
        let renderPath = tool.isLocal ? 'courses/run-tool-local' : 'courses/run-lti';
        res.render(renderPath, {
            course: course,
            title: `${tool.name}, Kurs/Fach: ${course.name}`,
            tool: tool
        });
    });
};

const addLinkHandler = (req, res, next) => {
	// TODO: validate LTI response
	api(req).get('/ltiTools/' + req.params.ltiToolId)
		.then((tool) => {
			const idToken = jwt.verify(req.body.id_token, tool.key, { algorithm: 'RS256' });
			if (idToken.iss !== tool.oAuthClientId) {
				res.send('Issuer stimmt nicht überein.')
			}
			if (idToken.aud !== (process.env.FRONTEND_URL || 'http://localhost:3100/')) {
				res.send('Audience stimmt nicht überein.')
			}

			const content = idToken['https://purl.imsglobal.org/spec/lti-dl/claim/content_items'];
			res.render('courses/deep-link', {
				url: content.url,
				title: content.title,
			});

		});
}


// secure routes
router.use(authHelper.authChecker);

router.get('/', (req, res, next) => {
    const context = req.originalUrl.split('/')[1];
    res.redirect(`/${context}/` + req.params.courseId);
});

router.get('/add', addToolHandler);
router.post('/add', createToolHandler);

router.get('/run/:ltiToolId', runToolHandler);
router.get('/show/:ltiToolId', showToolHandler);
router.post('/link/:ltiToolId', addLinkHandler);

router.get('/:id', getDetailHandler);

router.delete('/delete/:ltiToolId', function (req, res, next) {
    const context = req.originalUrl.split('/')[1];
    api(req).patch(`/${context}/` + req.params.courseId, {
        json: {
            $pull: {
                ltiToolIds: req.params.ltiToolId
            }
        }
    }).then(_ => {
        api(req).delete('/ltiTools/' + req.params.ltiToolId).then(_ => {
            res.sendStatus(200);
        });
    });
});

module.exports = router;
