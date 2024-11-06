#### <img src="resources/img/brain.png" width="50px"/> listable

listable is a full-featured list/note/to-do web app that allows you to save and keep track of everything you want to remember, all with a productivity-focused UI that is clean, appealing, intuitive, and fast.

https://github.com/Theobragstad/listable/assets/48075045/65114060-76df-4669-8c82-904b4ca923af


___
### Main features:  
- Google sign in
- Create and edit lists and notes
- Delete and archive lists
- Change list background colors
- Create and assign labels to lists
- Search across content, titles, users, labels, and location
- Share lists to collaborate with other users
- Select lists to perform actions on multiple lists at once
- Copy lists
- Keep track of your work with edit and create timestamps
___
### Try listable locally:  
- You'll need a `.env` file. This is used for Google OAuth and other app features. You can contact me at `theobragstad2@gmail.com` for the credentials.
-   Alternatively, you can create your own `.env`, but at a minimum you'll need a Google OAuth client ID and client secret so you can login. You'll also need to update the URIs to match those used in the app. An empty `.env` is included in the repository.
- Make sure Docker Desktop is downloaded and running
- Clone or download this repository
- Navigate to the project folder in a terminal
- Run `docker compose up`
- Go to `localhost:3000` in a browser
