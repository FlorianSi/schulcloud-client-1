const express = require("express");

const router = express.Router();
const winston = require("winston");
const api = require("../api");
const { authChecker } = require("../helpers/authentication");
const { notificationParser } = require('../helpers/notification');

const logger = winston.createLogger({
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.simple()
			)
		})
	]
});

const postRequest = (req, res, next) => {
	if (process.env.NOTIFICATION_SERVICE_ENABLED) {
		api(req)
			.post(res.locals.url, {
				body: res.locals.body
			})
			.then(response => {
				res.json(response);
			})
			.catch(err => res.status(500).send("notification service error"));
	} else {
		res.status(500).send("notification service not enabled");
	}
};

router.delete("/device", authChecker, (req, res, next) => {
	if (process.env.NOTIFICATION_SERVICE_ENABLED) {
		api(req)
			.delete(`notification/devices/${req.body.id}`)
			.then(() => res.sendStatus(200));
	} else {
		res.status(500).send("notification service not enabled");
	}
});

router.delete("/:id", authChecker, (req, res, next) => {
	if (process.env.NOTIFICATION_SERVICE_ENABLED) {
		api(req)
			.delete(`notification/messages/${req.params.id}`)
			.then(() => res.sendStatus(200));
	} else {
		res.status(500).send("notification service not enabled");
	}
});

router.post(
	"/devices",
	authChecker,
	(req, res, next) => {
		res.locals.url = "notification/devices";
		res.locals.body = {
			userId: res.locals.currentUser._id,
			token: req.body.id,
			service: req.body.service
		};
		next();
	},
	postRequest
);

router.post("/getDevices", authChecker, (req, res, next) => {
	api(req)
		.get("/notification/devices")
		.then(devices => {
			res.json(devices);
		})
		.catch(err => {
			winston.error(err);
			res.send(500);
		});
});

router.get("/configuration/:config", authChecker, (req, res, next) => {
	api(req)
		.get(`/notification/configuration/${req.params.config}`)
		.then(config => {
			res.json(config);
		})
		.catch(err => {
			winston.error(err);
			res.send(500);
		});
});

router.post("/configuration/:config", authChecker, (req, res, next) => {
	// set config values of form data to true if anything set otherwise false
	const body = {};
	Object.keys(req.body).forEach(key => {
		body[key] = {
			push: !!req.body[key].push,
			mail: !!req.body[key].mail
		};
	});
	api(req)
		.patch(`/notification/configuration/${req.params.config}`, {
			body
		})
		.then(options => res.json(options))
		.catch(err => {
			winston.error(err);
			res.send(500);
		});
});

router.post("/callback", (req, res, next) => {
	res.locals.url = "notification/callback";
	res.locals.body = req.body;

	const sendClientResponse = response => {
		if (response && response.redirect && response.redirect !== null) {
			return res.redirect(response.redirect);
		}
		return res.redirect("/");
	};

	res.locals.url = "notification/callback";
	res.locals.body = {
		messageId: req.params.messageId,
		receiverId: req.params.receiverId,
		redirect: req.query.redirect || null
	};
	if (process.env.NOTIFICATION_SERVICE_ENABLED) {
		api(req)
			.post(res.locals.url, {
				body: res.locals.body
			})
			.then(response => sendClientResponse(response))
			.catch(err => {
				logger.error("could not mark message as read", err);
				return sendClientResponse();
			});
	} else {
		logger.error(
			"could not mark message as read because notification service was disabled, redirect"
		);
		return sendClientResponse();
	}
});

router.post(
	"/message",
	authChecker,
	(req, res, next) => {
		res.locals.url = "notification/messages";
		res.locals.body = req.body;

		next();
	},
	postRequest
);

router.get("/message/:id", authChecker, (req, res, next) => {
	if (process.env.NOTIFICATION_SERVICE_ENABLED) {
		api(req)
			.get(`notification/messages/${req.params.id}`)
			.then(response => {
				res.render(
					"lib/components/notification-details",
					response.data
				);
			});
	} else {
		res.status(500).send("notification service not enabled");
	}
});

router.get("/messages", authChecker, (req, res, next) => {
	if (process.env.NOTIFICATION_SERVICE_ENABLED) {
		let options = {};
		if (req.query.skip) {
			options.skip = req.query.skip;
		}
		if (req.query.limit) {
			options.limit = req.query.limit;
		}
		const params =
			"?" +
			Object.keys(options)
				.map(key => key + "=" + options[key])
				.join("&");
		api(req)
			.get(`notification/messages${params}`)
			.then(response => {
				res.render("lib/components/notification-list", {
					notifications: response.data.map(notification => notificationParser(notification)),
					meta: response.meta
				});
			});
	} else {
		res.status(500).send("notification service not enabled");
	}
});

router.post('/messages/removeAll', authChecker, (req, res, next) => {
	if (process.env.NOTIFICATION_SERVICE_ENABLED) {
		api(req).delete('/notification/messages/removeAll').then(response => res.send(response)).catch(error => res.error(error));
	} else {
		res.status(500).send("notification service not enabled");
	}
});

router.post(
	"/push/test",
	authChecker,
	(req, res, next) => {
		const user = res.locals.currentUser;
		user.id = user._id;
		res.locals.url = "notification/push";
		res.locals.body = {
			payload: {
				title: "Test-Benachrichtigung",
				message: "wurde erfolgreich zugestellt!"
			},
			users: [user],
			template: "global-push-message"
		};
		next();
	},
	postRequest
);

module.exports = router;
