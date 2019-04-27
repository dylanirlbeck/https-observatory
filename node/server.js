/** Server using Node.js and Express
 * This file all network-oriented code:
 *  - HTTP status codes
 *  - security headers
 *  - authentication logic (later)
 */

"use strict"

/* Node.js standard libraries */
const fs = require("fs")
const path = require("path")
const fetch = require('node-fetch')

/* NPM libraries */
const express = require("express")
const compression = require("compression")
const helmet = require("helmet")

/* Custom libraries */
//const database = require("./database/database.js")
const sql = require("mysql")

/* Configuration */
const configuration = require("./configuration.json").express

const configurationDB = require("./configuration.json").database

// Where database state file is
const state_file_path = __dirname + "/" + configuration.state

const credentials = configurationDB.connection

if (credentials.password === "" || credentials.password === undefined || credentials.password === null)
  console.warn("YOU SHOULD SET A PASSWORD ON THE DATABASE")

const connection = sql.createConnection(credentials)

/* Make Node crash on unhandled promise rejection
 * Unhandled promise rejection is deprecated
 * Source: https://medium.com/@dtinth/making-unhandled-promise-rejections-crash-the-node-js-process-ffc27cfcc9dd
 */
process.on("unhandledRejection", up => {
  throw up
})

/**
 * This is the main function of the entire server.
 * It is async so that we can use await inside of it.
 */
const main = async () => {
  // First, load all data
  //const loaded = await database.loadData()
  //console.log("Loaded data", loaded)

  // Start Express server
  const server = express()

  // Set mode to production
  server.set("env", configuration.env)

  // Do not leak information about Express server in "x-powered-by" header
  server.disable("x-powered-by")

  // Compress trafic to save bandwidth
  server.use(compression())

  server.use(helmet({
    // Set "X-Frame-Options: DENY"
    "frameguard": {
      "action": "deny"
    },
    // Set "Referrer-Policy: no-referrer"
    "referrerPolicy": {
      "policy": "no-referrer"
    },
    // Content Security Policy
    "contentSecurityPolicy": {
      "directives": {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'"],
        "connect-src": ["'self'"],
        "worker-src": ["'none'"],
        "child-src": ["'none'"],
        "base-uri": ["'none'"]
      }
    },
    // Disable Adobe Flash and Adobe Acrobat
    "permittedCrossDomainPolicies": {
      "permittedPolicies": "none"
    }
  }))

  // Serve static content from webui folder
  const webui = path.join(__dirname, "/../docs")
  const xml = path.join(__dirname, "/../cache/https-everywhere/src/chrome/content/rules")
  server.use(express.static(webui))
  server.use("/xml/", express.static(xml)) // TODO: add midleware to track release ruleset?

  // Serve dynamic content from "/search?" API endpoint
  server.get("/search?", (request, response) => {
    const target = request.query.target

    if (target.length < 2) {
      // Status code 400 "Bad Request"
      response.status(400)
      response.setHeader("Content-Type", "application/json")
      response.send(JSON.stringify({
        "message": "Invalid input: Query requires two or more characters."
      }))
      return
    }

    database.searchByTarget(target)
      .then((ruleset) => {
        response.status(200)
        response.setHeader("Content-Type", "application/json")
        response.send(JSON.stringify(ruleset))
      })
  })

  server.get("/rulesetinfo?", (request, response) => {
    console.log("Request: /rulesetinfo? query:", JSON.stringify(request.query))

    const rulesetid = parseInt(request.query.rulesetid)

    database.getRulesetById(rulesetid)
      .then((ruleset) => {
        response.setHeader("Content-Type", "application/json")
        response.send(JSON.stringify(ruleset))
      })
  })

  // Parse body into JSON
  // This middlevare is put here so that it does not run for all the endpoints above.
  // All endpoints that accept requests with JSON payload in body must go below.
  server.use(express.json())

  //
  server.post("/new/", (request, response) => {
    // TODO: check authorization

    // Proposal contains the rulesetid of rule that is to be forked as well as info about its author
    const new_proposal = request.body

    database.newProposal(new_proposal)
      .then(result => {
        console.log(JSON.stringify(result))
        response.setHeader("Content-Type", "application/json")
        response.status(201)
        response.send(JSON.stringify({
          "message": "Created",
          "proposalid": result
        }))
      })

  })

  server.delete("/delete?", (request, response) => {
    // TODO: check authorization
    const proposalid = request.query.proposalid

    database.deleteProposal(proposalid)
      .then(() => {
        response.setHeader("Content-Type", "application/json")
        response.status(200)
        response.send(JSON.stringify({
          "message": "Deleted"
        }))
      })
      .catch(error => {
        response.setHeader("Content-Type", "application/json")
        response.status(400)
        response.send(JSON.stringify({
          "message": "You are being weird."
        }))
      })
  })

  server.put("/save/", (request, response) => {
    // TODO: check authorization

    // Proposal contains the proposed ruleset as well as info about its author
    const proposal = request.body

    console.log(JSON.stringify(proposal))
    // TODO: handle database errors, logged out users
    database.saveProposal(proposal)
    response.setHeader("Content-Type", "application/json")
    response.status(200)
    response.send(JSON.stringify({
      'message': 'Updated'
    }))
  })


  /* This code will store the code for the Github Integeration. The basic idea
  is as follows:
  1. Users are redirected to reqeust their Github identity
  2. Users are redirected back to your site by Github
  3. Use the access token to access the API
    - store this in a database, give user our own session token
  */

  server.get('/user/signin/callback', function(req, res, next) {
    const {
      query
    } = req;
    // ?code=_______
    const {
      code
    } = query;
    if (!code) {
      return res.send({
        success: false,
        message: 'Error: no code'
      });
    }

    // POST
    fetch("https://github.com/login/oauth/access_token", {
        method: "post",
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },

        //make sure to serialize your JSON body
        body: JSON.stringify({
          'client_id': 'd2ca1b154f386bebe395',
          'client_secret': '15af90cd31cd4f4a495087ce84e79342956a8ee8',
          'code': code
        })
      })
      .then((data) => {
        return data.json();
      })
      .then((response) => {
        const user = {
          github_id: "",
          access_token: ""
        };
        console.log(response.access_token);
        fetch("https://api.github.com/user", {
          headers: {
            'Authorization': 'token ' + response.access_token
          },
        }).catch((e)=>{console.log(e);})
          .then( (resp) => {
            return resp.json();
          })
          .then((data) => {
            user.github_id = data.login;
            user.access_token = response.access_token;
          })
        res.redirect(301, '/');
        // NEED TO INSERT user into database
        const args = [];
        args.push([user.github_id,
          user.access_token])
        const query = "INSERT INTO users (github_id, github_token) VALUES ?"
        connection.query(query, args, function (error, results, fields) {
          if (error){
            console.log(error)
            console.log(results)
            console.log(fields)
            //reject([error, results, fields])
          }
          else resolve(results)
        })
      });
    //console.log('code', code);
  });





  server.listen(configuration.port, () =>
    console.log(`Server listening on port ${configuration.port}`)
  )

}

// Start server
main()
