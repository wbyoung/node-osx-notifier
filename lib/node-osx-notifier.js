#! /usr/bin/env node

var path          = require('path');
var express       = require('express');
var exec          = require('child_process').execFile;

var port     = process.argv.length > 2 ? process.argv[2] : 1337;
var hostname = process.argv.length > 3 ? process.argv[3] : 'localhost';
var server   = express();

var root   = path.dirname(__dirname);
var binary = path.join(root, 'osx/terminal-notifier-{type}.app/Contents/MacOS/terminal-notifier');

function command(req, res, next) {
	req.data = req[this];
	req.file = binary.replace('{type}', req.params.type);
	req.args = [];
	Object.keys(req.data).forEach(function(arg){
		req.args.push('-' + arg);
		req.args.push(req.data[arg]);
	});
	next();
}

function execute(file, args, callback) {
	exec(file, args, function(error, stdout){
		stdout = stdout ? stdout.trim().split('\n') : null;
		if (error) {
			error.error = stdout || 'invalid type.';
			callback(error);
		} else {
			callback(null, stdout || ['done.']);
		}
	});
}

function list(rows) {
	var notifications = []
		;
	var headers = rows.shift().toLowerCase()
		.replace(' ', '_').replace('id', '_id').split('\t');
	rows.forEach(function(row){
		var cols = row.split('\t');
		var result = {};
		cols.forEach(function(col, i){
			result[headers[i]] = col === '(null)' ? null : col;
		});
		notifications.push(result);
	});
	return { notifications: notifications };
}

function route(req, res) {
	console.log.apply(console, ['>'].concat(req.args));
	execute(req.file, req.args, function(error, input){
		if (error) {
			res.json(error);
		} else if(req.data.list) {
			res.json(list(input));
		} else {
			res.json({status:input[0]});
		}
	});
}

if(!module.parent) {
	// setup routes
	server.use(express.bodyParser());
	server.get('/:type', command.bind('query'), route);
	server.post('/:type', command.bind('body'), route);

	// start server
	console.info('starting server...');
	server.listen(port, hostname, function(){
		console.info('server started:', 'http://'+hostname+':'+port);
	});
} else {
	module.exports = {
		/**
		 * Exported interface.
		 * @param type
		 * @param args
		 * @param [opts]
		 * @param [cb]
		 */
		call: function(type, args, opts, cb) {
			// opts is optional, if argument in position 3 is a function, it was
			// omitted.
			if (typeof opts === 'function') {
				cb = opts;
				opts = {};
			}

			// cb is optional, but always provide a callback to execute
			cb = cb || function() {};

			if (opts.verbose) {
				console.info.apply(console, ['Notifying >'].concat([type], args));
			}

			var file = binary.replace('{type}', type);
			var method_args = [];
			Object.keys(args).forEach(function(arg){
				method_args.push('-' + arg);
				method_args.push(args[arg]);
			});

			execute(file, method_args, cb);
		}
	};
}