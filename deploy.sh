cd ~/schulcloud-client/
curl -s -X POST https://api.telegram.org/bot$BOT_ID/sendMessage -d text="$NODE_ENV Server - updating" -d chat_id=$CHAT_ID
git pull
npm install
webpack -d
forever restart server.js
curl -s -X POST https://api.telegram.org/bot$BOT_ID/sendMessage -d text="$NODE_ENV Server - update done" -d chat_id=$CHAT_ID
