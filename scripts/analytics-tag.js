// The Vercel Web Analytics tag used on every counted page (index, FIELD LOG, essays, instagram).
//
// Staff browsers are not counted: a browser registered at /staff/ (through a signed-in 6000 KNOCKS member — see
// api/staff.js) carries the first-party cookie `twt_staff=1` (and localStorage `twt_staff`). This check runs BEFORE
// the analytics script is requested: for a staff browser /_vercel/insights/script.js is never loaded, so nothing is
// sent. Everyone else gets exactly the script they got before.
//
// Keep this string identical everywhere — test/staff.test.js checks every page against it.
const TAG =
  '<script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };' +
  '(function(){var staff=false;try{staff=/(?:^|;\\s*)twt_staff=1(?:;|$)/.test(document.cookie)||localStorage.getItem("twt_staff")==="1"}catch(e){}' +
  'if(staff)return;var s=document.createElement("script");s.defer=true;s.src="/_vercel/insights/script.js";document.head.appendChild(s)})();</script>';

module.exports = { TAG };
