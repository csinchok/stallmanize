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

function loadUrl(url) {

    const options = {
        host: '127.0.0.1',
        port: argv.port
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
        spawn('chromium-browser', ['--app=' + url, '--remote-debugging-port=' + argv.port], {
            detached: true,
            stdio: 'ignore'
        }).unref();
    })
}


// 'https://attwiw.com/2018/02/08/today-in-middle-eastern-history-iraqs-ramadan-revolution-1963/'
request.get(argv.url, (err, res, body) => {
    var dom = new JSDOM(body, {'url': argv.url});
    Node = dom.window.Node;
    var readable = new Readability(argv.url, dom.window.document).parse();
    var tempPath = tempy.file({extension: 'html'})

    fs.writeFile(tempPath, readable.content, (err) => {  
        // throws an error, you could also catch it here
        if (err) throw err;
    
        // success case, the file was saved
        console.log(tempPath);

        loadUrl('file://' + tempPath);
    });
});