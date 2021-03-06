var express = require("express");
var app = express();
var request = require("request");

var USER_HOST = "localhost";
var USER_PORT = 3000;

var CONVERSACION_HOST = "admin.gaiameet.com";
var CONVERSACION_PORT = 9001;
var CONVERSACIONES_MAX = 15;

function cors(res) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
}

var user = (function() {
	return {
		cons: {
			HOST: "localhost",
			PORT: 3000
		},
		data: {
			sessions: {}
		},
		get: function(path, cb) {
			return this.request("get", path, {}, cb);
		},
		post: function(path, data, cb) {
			return this.request("post", path, data, cb);
		},
		patch: function(path, data, cb) {
			return this.request("patch", path, data, cb);
		},
		delete: function(path, data, cb) {
			return this.request("delete", path, data, cb);
		},
		request: function(method, path, data, cb) {
			var url = "http://" + this.cons.HOST + ":" + this.cons.PORT + path;
			if (method === "get") {
				return request.get(url, function(error, response, body) {
					if (cb) {
						cb(error, response, body);
					}
				});
			} else if (method === "post" || method === "patch" || method === "delete") {
				if ("patch") {
					delete data.accessToken;
				}
				if (method === "delete" && path === "/api/Clients/") {
					return null;
				}
				return request[method]({
					url: url,
					form: data
				}, function(error, response, body) {
					if (cb) {
						cb(error, response, body);
					}
				});
			}
		},
		isDown: function(cb) {
			this.get("/").on("error", function() {
				cb();
			});
		},
		replaceMacros: function(string, query) {
			var macros = {
				"{userId}": function() {
					if (query.accessToken && user.data.sessions[query.accessToken]) {
						return user.data.sessions[query.accessToken].userId;
					} else {
						return "";
					}
				}
			}, i;
			if (string) {
				for (i in macros) {
					string = string.replace(i, macros[i]());
				}
			}
			return string || "";
		},
		register: function(method, local, endMethod, _endpoint, cb) {
			app[method](local, function(req, res) {
				var endpoint = user.replaceMacros(_endpoint, req.query);
				if (endMethod === "post" || endMethod === "patch" || endMethod === "delete") {
					user[endMethod](endpoint, req.query, function(error, response, body) {
						cors(res);
						if (cb) {
							cb(error, response, body, res);
						} else {
							res.send(body);
						}
					});
				} else {
					user.get(endpoint, function(error, response, body) {
						if (cb) {
							cb(error, response, body, res);
						} else {
							cors(res);
							res.send(body);
						}
					});
				}
			});
		}
	}
})();

function getConversaciones(email, cb) {
	request.get("http://" + CONVERSACION_HOST + ":" + CONVERSACION_PORT + "/conversacion", function(error, response, body) {
		var i, total, data = [];
		if (! error && body) {
			body = JSON.parse(body);
			for (i = 0; i < body.length; i++) {
				if (body[i].owner == email) {
					data.push(body[i]);
				}
			}
			cb(data);
		}
	});
}

app.get("/user/conversaciones", function(req, res) {
	if (req.query.email) {
		getConversaciones(req.query.email, function(data) {
			data = data.slice(0, CONVERSACIONES_MAX);
			cors(res);
			res.send(data);
		});
	}
});

app.get("/user/stats", function(req, res) {
	if (req.query.email) {
		getConversaciones(req.query.email, function(data) {
			var r = {}, i, _fecha, fecha, _r = [], total = 0, fechas = 0;
			for (i = 0; i < data.length; i++) {
				_fecha = new Date(data[i].createdAt);
				fecha = _fecha.getDate().toString() + "/" + (_fecha.getMonth() + 1).toString() + "/" + _fecha.getFullYear().toString();
				if (r[fecha]) {
					r[fecha] = r[fecha] + 1;
					total++;
				} else {
					r[fecha] = 1;
					total++;
					fechas++;
				}	
			}
			for (i in r) {
				_r.push([i, r[i]]);
			}
			cors(res);
			res.send({ convperday: _r, totalconv: total, avg: total  / (fechas > 0 ? fechas : 1) });
		});
	}
});

user.register("get", "/user/login", "post", "/api/Clients/login", function(error, response, body, res) {
	var d = JSON.parse(body);
	if (d && !d.error && d.id && d.userId) {
		user.data.sessions[d.id] = {
			userId: d.userId
		};
		res.send(JSON.stringify({"accessToken": d.id}));
	} else {
		cors(res);
		res.send(body);
	}
});
user.register("get", "/user/register", "post", "/api/Clients");
user.register("get", "/user/login", "post", "/api/Clients/login");
user.register("get", "/user/logout", "post", "/api/Clients/logout");
user.register("get", "/user/info", "get", "/api/Clients/{userId}");
user.register("get", "/user/logout", "get", "/api/Clients/{userId}");
user.register("get", "/user/set", "patch", "/api/Clients/{userId}");
user.register("get", "/user/delete", "delete", "/api/Clients/{userId}");

app.get('/', function (req, res) {
	res.send('');
});

app.listen(3001, function () {
	user.isDown(function() {
		console.log("Servicio user no esta levantado");
		process.exit();
	});
	console.log("Iniciado servicio portal");
});

