const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

let userSessions = {}; 

function getEligibleSchemes(data) {
    let s = []; 
    const inc = parseInt(data.income);
    const age = parseInt(data.age);
    const area = data.area; // A: Gramya, B: Shaheri
    const bpl = data.bpl === 'A';

    // ૧. કુંવરબાઈનું મામેરૂ [cite: 1]
    if (data.special === 'C' && ((area === 'A' && inc <= 120000) || (area === 'B' && inc <= 150000))) s.push("૧. કુંવરબાઈનું મામેરૂ યોજના");
    
    // ૨. માનવ ગરીમા યોજના [cite: 1]
    if (age >= 18 && age <= 60 && ((area === 'A' && inc <= 120000) || (area === 'B' && inc <= 150000))) s.push("૨. માનવ ગરીમા યોજના");

    // ૩. વ્હાલી દીકરી યોજના [cite: 2]
    if (data.isGirlChild && inc <= 200000) s.push("૭. વ્હાલી દીકરી યોજના");

    // ૪. ગંગા સ્વરૂપા (વિધવા) સહાય [cite: 2]
    if (data.special === 'A' && ((area === 'A' && inc <= 120000) || (area === 'B' && inc <= 150000))) s.push("૮. ગંગા સ્વરૂપા આર્થિક સહાય યોજના");

    // ૫. વૃદ્ધ પેન્શન (વયવંદના) [cite: 3]
    if (age >= 60 && bpl) s.push("૧૦. વયવંદના વૃદ્ધ પેન્શન યોજના");

    // ૬. ખેડૂત સહાય (PM કિસાન & ગાય નિભાવ) [cite: 4, 27]
    if (data.occupation === 'A') {
        s.push("૨૪. પી.એમ. કીસાન યોજના");
        s.push("૪૩. દેશી ગાય નિભાવ ખર્ચ યોજના");
    }

    // ૭. દિવ્યાંગ સહાય [cite: 1, 3]
    if (data.special === 'B') {
        s.push("૪. દિવ્યાંગ એસ.ટી. બસ પાસ યોજના");
        s.push("૧૧. દિવ્યાંગ પેન્શન યોજના");
    }

    return s;
}

app.post('/webhook', async (req, res) => {
    const { customer, message } = req.body;
    if (!customer || !message) return res.sendStatus(200);
    const uid = customer.id;
    const txt = message.text ? message.text.trim() : "";

    if (!userSessions[uid]) {
        userSessions[uid] = { step: 0, answers: {} };
        await sendMsg(uid, "નમસ્તે પ્રવીણભાઈ, યોજના સહાય બોટમાં તમારું સ્વાગત છે. \n૧. તમે ક્યાં રહો છો? (A) ગ્રામ્ય (B) શહેરી");
    } else {
        let session = userSessions[uid];
        const steps = ["area", "income", "category", "bpl", "age", "occupation", "special"];
        session.answers[steps[session.step]] = txt;
        session.step++;

        const questions = [
            "", 
            "૨. કુટુંબની વાર્ષિક આવક કેટલી છે? (આંકડામાં લખો)",
            "૩. કેટેગરી: (A) SC (B) ST (C) OBC (D) General (E) કુંભાર",
            "૪. BPL કાર્ડ છે? (A) હા (B) ના",
            "૫. તમારી ઉંમર કેટલી છે?",
            "૬. વ્યવસાય: (A) ખેડૂત (B) શ્રમિક (C) ફેરીયા (D) અન્ય",
            "૭. ખાસ સ્થિતિ? (A) વિધવા (B) દિવ્યાંગ (C) દીકરીના લગ્ન (D) કોઈ નહીં"
        ];

        if (session.step < questions.length) {
            await sendMsg(uid, questions[session.step]);
        } else {
            const eligible = getEligibleSchemes(session.answers);
            let reply = "તમારા જવાબ મુજબ તમે આ યોજનાઓ માટે લાયક છો:\n\n" + (eligible.length > 0 ? eligible.join("\n") : "ક્ષમા કરશો, કોઈ મેચિંગ યોજના મળી નથી.");
            reply += "\n\nહવે તમારા 'આધાર કાર્ડ' નો ફોટો મોકલો, હું OCR દ્વારા ફોર્મ ભરવાનું શરૂ કરું છું.";
            await sendMsg(uid, reply);
            delete userSessions[uid];
        }
    }
    res.sendStatus(200);
});

async function sendMsg(uid, text) {
    try {
        await axios.post('https://api.interakt.ai/v1/public/message/', { userId: uid, message: text }, 
        { headers: { 'Authorization': 'Basic YOUR_INTERAKT_API_KEY' }});
    } catch (e) { console.log("Error sending message"); }
}

app.listen(process.env.PORT || 3000);
