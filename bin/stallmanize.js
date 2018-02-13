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
        console.log('not running....')
        spawn('chromium-browser', ['--app=' + url, '--remote-debugging-port=' + port], {
            detached: true,
            stdio: 'ignore'
        }).unref();
    })
}


function makeReadable(url, cbk) {
    // 'https://attwiw.com/2018/02/08/today-in-middle-eastern-history-iraqs-ramadan-revolution-1963/'
    request.get(url, (err, res, body) => {
        var dom = new JSDOM(body, {'url': url});
        Node = dom.window.Node;
        var readable = new Readability(url, dom.window.document).parse();

        var tempPath = tempy.file({extension: 'html'});
        var readableHtml = `
        <html>
            <head>
            <style>
                body {
                    font-family: Arial,Helvetica Neue,Helvetica,sans-serif; 
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