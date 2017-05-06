# Nautilus

A socket-based web app for running existing powershell scripts on an Office365 client.
 
* HTTPS (with Let's Encrypt, auto-renewing)
* Authentication required (using Passport-Local & Duo for 2FA)
* Usernames, passwords, and client info stored in MongoDB
* Special access for admin users (add/removing clients & users)
* Responsive design (Bootstrap)