"use strict"

// For network requests let's use the modern (circa 2014) fetch API
// We can ensure backwards-ompatibility later via a polyfill like
// https://github.github.io/fetch/ or https://github.com/developit/unfetch

/* Delay between submitting the search and showing loading animation
 * This should be small enough for user not to notice the delay,
 * but large enough for simple query to resolve and return.
 * The idea is, loading animation should not appear for a fraction of a second
 * because it essentally blinks and blinking is annoying.
 */
const loadingAnimationDelay = 500 /* ms */

// This is from https://code.google.com/archive/p/form-serialize/
const serialize = (form) => {
	if (!form || form.nodeName !== "FORM")
		return
	var i, j, q = []
	for (i = form.elements.length - 1; i >= 0; i = i - 1) {
		if (form.elements[i].name === "")
			continue
		switch (form.elements[i].nodeName) {
		case 'INPUT':
			switch (form.elements[i].type) {
			case 'text':
			case 'hidden':
			case 'password':
			case 'button':
			case 'reset':
			case 'submit':
				q.push(form.elements[i].name + "=" + encodeURIComponent(form.elements[i].value));
				break;
			case 'checkbox':
			case 'radio':
				if (form.elements[i].checked) {
					q.push(form.elements[i].name + "=" + encodeURIComponent(form.elements[i].value));
				}
				break;
			case 'file':
				break;
			}
			break;			 
		case 'TEXTAREA':
			q.push(form.elements[i].name + "=" + encodeURIComponent(form.elements[i].value));
			break;
		case 'SELECT':
			switch (form.elements[i].type) {
			case 'select-one':
				q.push(form.elements[i].name + "=" + encodeURIComponent(form.elements[i].value));
				break;
			case 'select-multiple':
				for (j = form.elements[i].options.length - 1; j >= 0; j = j - 1) {
					if (form.elements[i].options[j].selected) {
						q.push(form.elements[i].name + "=" + encodeURIComponent(form.elements[i].options[j].value));
					}
				}
				break;
			}
			break;
		case 'BUTTON':
			switch (form.elements[i].type) {
			case 'reset':
			case 'submit':
			case 'button':
				q.push(form.elements[i].name + "=" + encodeURIComponent(form.elements[i].value));
				break;
			}
			break;
		}
	}
	return q.join("&");
}

function btnClick(value){
	window.location.href = "/submission/?rulesetid=" + value
	// rulesetIdReceiver(value)
}

const hideFeedback = () => {
	document.getElementById("result").classList.add("hidden")
	document.getElementById("invalid-input").classList.add("hidden")
	document.getElementById("lds-roller").classList.add("hidden")
}

const showLoadingAnimation = () => {
	// Start loader animation and results div and errors to invisible
	// Show "loading" animation
	console.log("Showing load animation")
	document.getElementById("lds-roller").classList.remove("hidden")
}

const showSearchError = (message) => {
	message = message || "Invalid input."
	document.getElementById("invalid-input-message").innerText = message
	document.getElementById("invalid-input").classList.remove("hidden")
}

// TODO: use DOMContentLoaded
window.addEventListener("load", function(event){
	document.getElementById("search").addEventListener("submit", function(event){
		event.preventDefault()

		// Hide all messages that are currently displayed
		hideFeedback()

		// Error is true if the search query is less than 3 characters
		const target = document.querySelector("INPUT[name='target']").value

		// Show loading animation after a short delay (see commend above for explanation)
		const loadingAnimationTimer = setTimeout(showLoadingAnimation, loadingAnimationDelay)

		const url = "/search?" + serialize(event.target)

		fetch(url)
		.then(async (response) => {	// Check if fetch suceeded and extract the data
			// Don't show loading animation
			clearTimeout(loadingAnimationTimer)

			if (response.ok) {
				return response.json()
			} else {
				const data = await response.json()
				return Promise.reject(new Error(data.message))
			}
		})
		.then(function(data) {
			// Clear body of results field
			document.getElementById("result-box").innerHTML = ""

			// Show error if there are no results
			if (data.length === 0){
				// TODO: Design thing: should we have different UIs for
				// errors and empty result set?
				showSearchError("No results found.")
				return
			}

			// Iterate through every target found and create row
			for (const target_found of data) {
				// Parent row div
				const result = document.createElement("div")
				result.setAttribute("class", "Box-row")

				const header = document.createElement("div")
				header.setAttribute("class", "d-flex flex-items-center")


				// Holds ruleset name and file name
				const row_title = document.createElement("div")
				row_title.setAttribute("class", "flex-auto")

				// ruleset name
				const name = document.createElement("strong")
				name.innerText = target_found.name

				// ruleset file name
				const file = document.createElement("div")
				file.setAttribute("class", "text-small text-gray-light")
				file.innerText = target_found.file

				const targets = document.createElement("div")
				targets.setAttribute("class", "text-small text-gray-light")
				targets.innerText = target_found.targets.join(", ")


				// Button to send ruleset id to pr form
				const button = document.createElement("button")
				button.setAttribute("onclick", "btnClick(value)")
				button.setAttribute("type", "button")
				button.setAttribute("class", "btn btn-sm")
				button.setAttribute("name", "button")
				button.setAttribute("value", target_found.rulesetid)
				button.innerText = "View"

				header.appendChild(row_title)
				header.appendChild(button)
				result.appendChild(header)
				row_title.appendChild(name)
				row_title.appendChild(file)
				result.appendChild(targets)

				document.getElementById("result-box").appendChild(result)
			}

			// Show results field and hide loading animation
			document.getElementById("result").classList.remove("hidden")
			document.getElementById("lds-roller").classList.add("hidden")
		}).catch ((error) => {
			clearTimeout(loadingAnimationTimer)
			const str = error.toString()
			const message = str.substr(str.indexOf(": ")+2)
			hideFeedback() // to hide loading animation
			showSearchError(message)
		})

		return false
	})
})


