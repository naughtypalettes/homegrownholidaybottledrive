/*
  Homegrown Holiday Bottle Drive: site configuration
  ==================================================

  Day to day, you DON'T edit this file. Placeholders such as the amount raised,
  the bags-out time and the FAQ details live in the "Settings" tab of the
  bottle drive Google Sheet. The page reads that tab every time it loads.

  Edit this file only to:
    1. paste in the Apps Script web app URL once (see README.md), and
    2. point the header and footer links at the right pages on Homegrown's site.

  The `settings` block below is a fallback: it's used when the Sheet can't be
  reached, or before it's connected. A blank value means "not confirmed yet",
  and the page keeps showing the [BRACKETED] placeholder from the design.
*/
window.HG_CONFIG = {
  // Paste the "Web app" URL from Apps Script > Deploy here.
  // Leave it blank and the form runs in PREVIEW mode: nothing is saved or emailed.
  appsScriptUrl: '',

  // Links in the header and footer. '#' = not set yet.
  links: {
    home: '#',
    about: '#',
    programs: '#',
    events: '#',
    sparks: '#',
    instagram: 'https://www.instagram.com/weare.homegrown/',
    discord: '#',
    emailList: '#'
  },

  settings: {
    goal: '2500',                  // confirmed by Amar
    campaign_start: '2026-12-10',  // first pickup Thursday
    zones: 'South, North, East, West, Downtown' // [CONFIRM ZONES]
  }
};
