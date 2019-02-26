"use strict"


//const simpleGit = require('simple-git')();
/* How often we want to make our pulls - currently 15 minutes */
// TODO: make it not a timer but a git hook
const intervalAmount = 1000*60*15
const exec = require("child_process").exec
var connection;

function updateDatabase(file_differences, loadDataRules) {
	console.log("Inside updateDatabase!")
	const fileList = file_differences.split("\n")
	for (file of fileList)
		loadDataRules(file)
}

function makePulls(loadDataRules) {
	console.log("Executing makePulls...")
	console.log('Starting directory: ' + process.cwd())
	try {
		if (process.cwd().includes('https-everywhere') == 0) { 
			process.chdir('../cache/https-everywhere')
		}
		console.log('New directory: ' + process.cwd())
	}
	catch (err) {
		console.log('error in makePulls: ' + err)
	}
	var preCommit = exec("git rev-parse HEAD", function(err, stdout_pre, stderr) {
		console.log(stdout_pre)
		var pulling = exec("git pull", function(err, stdout_pull, stderr) {
			console.log("Pulling...")
			var postCommit = exec("git rev-parse HEAD", function(err, stdout_post, stderr) {
				console.log(stdout_post)
				exec("git diff" + preCommit + " " + postCommit + "--name-only",
					function(err, stdout_differences, stderr) {
						// this function will update the database in the case of differences
						if (stdout_differences != "") {
							updateDatabase(stdout_difference, loadDataRules)
						} else {
							console.log("No file differences...")
						}
					})
			})
		})
		console.log("")
	})
}
//var testList = "AdBlock.xml\nAdButler.xml\nAdExcite.xml";
//updateDatabase(testList);

const checkOnTimer = (connection_, loadDataRules) => {
  connection = connection_;
  makePulls(loadDataRules)
  setInterval(makePulls, intervalAmount);
}


// dir.on('exit', function (code) {
//   // exit code is code
// });

// var execProcess = require("./exec_process.js");
// execProcess.result("sh update_records.sh", function(err, response){
//     if(!err){
//         console.log(response);
//     }else {
//         console.log(err);
//     }
// });

// require('simple-git')()
//      .exec(() => console.log('Starting pull...'))
//      .pull((err, update) => {
//         if(update && update.summary.changes) {
//            require('child_process').exec('npm restart');
//         }
//      })
//      .exec(() => console.log('pull done.'));

module.exports = {
  checkOnTimer: checkOnTimer
}
