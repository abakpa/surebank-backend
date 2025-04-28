const axios = require("axios");
const qs = require("qs"); // Add this

const sendSMS = async (to, message) => {
    console.log("sms message", to, message);
    try {
        const response = await axios.post(
            "https://www.bulksmsnigeria.com/api/v1/sms/create",
            qs.stringify({
                api_token: process.env.SMS_API_TOKEN,
                from: process.env.SMS_SENDER_ID,
                to,
                body: message,
                dnd: 2,
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );

        return response.data;
    } catch (error) {
        console.error("SMS sending failed:", error.response?.data || error.message);
        throw error;
    }
};

module.exports = sendSMS;
