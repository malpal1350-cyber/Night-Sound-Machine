# Night-Machine
TEMPORARY NOTICE FOR ALL USERS!!! THE APP IS NOT A FULL DESKTOP APP. THE PWA OPTION (DOWNLOAD FROM THE WEBSITE LINK) IS CURRENTLY THE BEST WAY TO DOWNLOAD THE APP. I HOPEFULLY, IN THE NEAR FUTURE, TO HAVE A QUICK, EASY WAY TO DOWNLOAD THE FULL DESKTOP APP WITHOUT NEEDING DECENT COMPUTER KNOWLEDGE. THE PWA OPTION, SINCE IT'S TECHNICALLY A BROWSER APP, DOES NOT SUPPORT ALL THE FEATURES LIKE WIRELESS CONTROLS (HOPEFULLY GET TO ACTUALLY WORKING IN THE FUTURE) AND SCREEN SLEEP (MAINLY FOR LINUX). 

BECAUSE I DON'T HAVE THE BEST COMPUTER KNOWLEDGE, I DON'T REALLY KNOW HOW TO MAKE THIS APP A FULL DESKTOP APP

(Sorry for the all caps, but I need everyone to know this. All current users should not have an issue if you already have the PWA option or the other option. I do plan on removing the 2 app-running options for a full desktop app, meaning PWA won't work for new users when I finally get a working full desktop app in the future)


This is for those who don't like most boring sound machines or would like to be able to fully customize their experience. All you need to do is download the app. Recommended specs: use a Raspberry Pi 4 or newer for low power usage, 2 GB of RAM minimum (4 GB recommended), and at least 32 GB of storage (64 GB recommended).

Here is a subreddit to talk about the app: https://www.reddit.com/r/NightSoundMachine/s/nBNVclbFoh

Here is a YouTube video preview: https://youtu.be/gJUTFHntsTs

Donations would be appreciated. [Click the link for my Cash App. Thank you to those who donate and support this project, and I hope you all enjoy! https://cash.app/$IGGGames](https://cash.app/$IGGGames)

Features:
- Weather
- ScreenSaver
- Games
- Multiple sounds (and sound effects) can play at once, better than most sound machines, which can only play one sound at a time.
- Music Player
- Flashlight for night mode
- Schedule Start
- Alarm
- Offline Pro user optimized
- Tons of customizability

Note when downloading. There is a PWA option, [which is linked](https://night-machine--malpal1350.replit.app/), so you can download directly from the browser. If you just use it on the website and don't download it, you will have reliability issues due to strict browser limits, especially for audio, so use it in the browser for testing only. If for some reason you can't download from the browser (only browsers like Chrome and Chromium support PWA downloading), you can download the zip file. The app, when downloaded onto your device, will be under a GB.

To start, create groups, upload audio files, adjust group settings and profiles, and click Start. You can even use this as a regular audio player. And there are many other features, like an alarm. Enjoy!!

Create groups: choose a name, color, icon, and whether it is a main group, effect group, etc. Main sounds play constantly; for example, a 3-minute file of crickets, and an effect group is for something like thunder. You can have multiple files on an effect group, and they will be picked at random. You can choose when this happens. 

Also, you can choose to limit, for example, after 5 plays or after a certain amount of time (fixed or random).

Notice that you have to find or make your own audio files (.mp3 or .wav). You can choose what you want; if you download from the web, listen to the audio first so you don't get unexpected sounds.

If you find a sound file you like, for example, a cricket sound, but it has a small cut at the end, use free software called Audacity to cut that pause so the audio file, when looped, doesn't have that pause.

The music player is just a basic audio player with playlists, a timer to end, and auto-stops when you start your night session.

You can have your session start manually, with a timer, or at a specific time. To end the session, you can end it manually, with a timer, or with an alarm. For ease of use, you can save custom timers and alarms so you only have to click 1 or 2 times to change an alarm instead of hassling to change values. (Make sure to add an alarm file in the preferences menu; otherwise, the session will auto-end without giving you a snooze option)

[Website Link for PWA Downloading: https://night-machine--malpal1350.replit.app/](https://night-machine--malpal1350.replit.app/)

My setup: I have a Raspberry Pi 5 with 4GB of RAM and 128GB of storage running ubuntu os. i use a 7in made for raspberry pi 5 touch screen and if i need to i have a wireless mouse i can quickly pull out of my night stand if i need it.



-- HERE ARE SOME EXTRA INSTRUCTIONS FOR INSTALLING THE APP IF YOU DO NOT CHOOSE TO GO TO THE PWA ROUTE AND WANT AN ACTUAL APP --

Here is a README-ready section for users who download the source ZIP instead of installing the PWA.

Important: The current root pnpm-workspace.yaml excludes Windows versions of some build dependencies. Those exclusions must be removed before advertising Windows support for the source ZIP.

## Run from a Downloaded ZIP
Night Sound Machine runs locally in your browser. Your sounds, preferences, schedules, and other app data remain on the device.
### Requirements
Install the following before starting:
- [Node.js 22 LTS](https://nodejs.org/)
- pnpm:
  ```bash
npm install --global pnpm

WINDOWS
Click Code → Download ZIP on GitHub.
Extract the ZIP to a permanent folder.
Open the extracted folder.
Right-click inside the folder and select Open in Terminal.
Install the required packages:
pnpm install

Start Night Sound Machine:
pnpm --filter @workspace/night-sound-machine run dev

Open the following address in Chrome or Edge:
http://localhost:3131

Keep the terminal window open while using the app. Press Ctrl+C in the terminal to stop it.

Linux
Download the ZIP from GitHub and extract it.
Open a terminal inside the extracted folder.
Install the required packages:
pnpm install

Start Night Sound Machine:
pnpm --filter @workspace/night-sound-machine run dev

Open the following address in Chromium, Chrome, or another modern browser:
http://localhost:3131

Keep the terminal open while using the app. Press Ctrl+C to stop it.

Optional Linux display helper
Linux users can start the optional display helper if they want Night Sound Machine to request operating-system display sleep:

pnpm --filter @workspace/night-sound-machine run display-helper

Run this in a second terminal while Night Sound Machine is running.

Updating
To update Night Sound Machine:

Download the newest ZIP from GitHub.
Extract it into a new folder.
Run pnpm install again.
Start the app using the instructions above.
Browser data normally remains associated with http://localhost:3131.
Continue using the same address and port to retain locally stored settings.

Troubleshooting

For
If pnpm is not recognized, close and reopen the terminal after installing it.

If port 3131 is already in use, stop the other program using that port and start Night Sound Machine again.

Do not open index.html directly from the extracted folder. Night Sound Machine must be started with
the provided command so browser storage, audio, and offline features work correctly.
