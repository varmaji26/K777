exports.createNXOrder = functions.https.onRequest((req, res) => {
    return cors(req, res, async () => {
        try {
            // ERROR FIX: Frontend 'data' ke andar bhej raha hai
            const body = req.body.data || req.body || {}; 
            const amount = body.amount;
            const userId = body.userId;
            const name = body.name;
            const mobile = body.mobile;

            // Check karein ki amount hai ya nahi
            if (!amount) {
                return res.status(400).send({ status: false, message: "Please Enter Amount Data" });
            }

            // IMB Stage URL
            const response = await axios.post("https://secure-stage.imb.org.in/api/create-order", {
                token: "8de24b146a5d4992b3ddc3f8b24432cf",
                amount: String(amount),
                order_id: "NX_" + (userId || "guest") + "_" + Date.now(),
                customer_name: name || "Customer",
                customer_mobile: mobile || "9999999999",
                callback_url: "https://nxwebhook-jg3plw6gha-uc.a.run.app" //
            });

            console.log("IMB RESPONSE:", response.data);
            res.status(200).send(response.data);

        } catch (error) {
            const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
            console.error("GATEWAY ERROR:", errorMsg);
            res.status(500).send({ status: false, error: "Gateway Error", details: errorMsg });
        }
    });
});