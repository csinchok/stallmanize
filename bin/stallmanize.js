#! /usr/bin/env node

const Readability = require('../lib/Readability.js')
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const request = require('request')
const tempy = require('tempy');
const fs = require('fs');
const process = require('process')
const CDP = require('chrome-remote-interface');
const yargs = require('yargs')

const { exec } = require('child_process');
var spawn = require('child_process').spawn;


yargs.options({
    url: {
        describe: 'The URL to parse and open',
    },
    port: {
        describe: 'The chromium debugger port',
        default: 9227
    }
}).demandOption(['url']);

const argv = yargs.argv;


function loadUrl(url, port) {

    const options = {
        host: '127.0.0.1',
        port: port
    };

    CDP(options, (client) => {

        const {Network, Page} = client;

        Page.loadEventFired(() => {
            client.close();
        });

        Promise.all([
            Network.enable(),
            Page.enable()
        ]).then(() => {
            Page.navigate({url: url})
        }).catch((err) => {
            client.close();
        });

    }).on('error', (err) => {
        spawn('chromium-browser', ['--app=' + url, '--remote-debugging-port=' + port], {
            detached: true,
            stdio: 'ignore'
        }).unref();
    })
}


function makeReadable(url, cbk) {
    // 'https://attwiw.com/2018/02/08/today-in-middle-eastern-history-iraqs-ramadan-revolution-1963/'

    var options = {
        'url': url,
        'headers': {
	    'User-Agent': 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:58.0) Gecko/20100101 Firefox/58.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
	}
    };

    request.get(options, (err, res, body) => {
        var dom = new JSDOM(body, {'url': url});
        Node = dom.window.Node;
        var loc = dom.window.document.location;
        var uri = {
            spec: loc.href,
            host: loc.host,
            prePath: loc.protocol + "//" + loc.host,
            scheme: loc.protocol.substr(0, loc.protocol.indexOf(":")),
            pathBase: loc.protocol + "//" + loc.host + loc.pathname.substr(0, loc.pathname.lastIndexOf("/") + 1)
          };
        var readable = new Readability(uri, dom.window.document).parse();

        if (!readable) {
	        return
        }
        
        var main_color = '#78C0A8';

        var tempPath = tempy.file({extension: 'html'});
        var readableHtml = `
        <html>
            <head>
            <style>
            body {
                font-family: Helvetica Neue,Helvetica,Arial,sans-serif;
	            padding: 10px;
		        color: #222222;
		        background-color: #fafafa;
            }
            body > h1 {
                border-bottom: 6px solid ${main_color};
                padding-bottom: 15px;
            }
	        .page {
		        font-size: 1.1em;
		        line-height: 1.4em;
		    }
	        p {
		        margin-top: 1.5em;
		        margin-bottom: 1.5em;
            }
            a {
                color: ${main_color};
                text-decoration: none;
                font-style: bold;
            }
            img {
                max-width: 100%;
                margin: 0 auto;
                display: block;
            }
            blockquote {
                font-size: 1.1em;
                width:80%;
                margin:50px auto;
                font-style:italic;
                color: #555555;
                padding:1.2em 30px 1.2em 50px;
                border-left:6px solid ${main_color};
                line-height:1.6;
                position: relative;
                background:#EDEDED;
            }
            blockquote::before {
                font-family:Arial;
                content: "\\201C";
                color: ${main_color};
                font-size:4em;
                position: absolute;
                left: 10px;
                top:-10px;
            }
            blockquote::after{
                content: '';
            }
            </style>
            </head>
            <body>
                <h1>${readable.title}</h1>
                ${readable.content}
            </body>
        </html>`;

        fs.writeFile(tempPath, readableHtml, (err) => {  
            // throws an error, you could also catch it here
            if (err) throw err;
        
            // success case, the file was saved, lets call back with the path
            cbk(tempPath)
        });
    });
}


makeReadable(argv.url, (path) => {
    loadUrl('file://' + path, argv.port);
})
