import 'dotenv/config'; // if needed, but I'll pass ASAAS_API_KEY
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const URL = 'https://api-sandbox.asaas.com/v3';

async function run() {
    const custRes = await fetch(`${URL}/customers`, {
        headers: { access_token: ASAAS_API_KEY }
    });
    const custs = await custRes.json();
    const customerId = custs.data[0].id;

    // Create subscription
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 7); // 7 days from now
    const nextStr = nextDueDate.toISOString().split('T')[0];

    const subRes = await fetch(`${URL}/subscriptions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', access_token: ASAAS_API_KEY },
        body: JSON.stringify({
            customer: customerId,
            billingType: 'PIX', // safer to test without a valid CC
            value: 29.90,
            nextDueDate: nextStr,
            cycle: 'MONTHLY',
            description: 'Test Sub'
        })
    });
    const sub = await subRes.json();
    console.log('Created sub:', sub.id);

    // Immediately query payments
    const payRes = await fetch(`${URL}/payments?subscription=${sub.id}`, {
        headers: { access_token: ASAAS_API_KEY }
    });
    const payments = await payRes.json();
    console.log(`Found ${payments.data.length} payments immediately.`);
    if (payments.data.length > 0) {
        console.log('First payment ID:', payments.data[0].id);

        // Try to update it
        const updateRes = await fetch(`${URL}/payments/${payments.data[0].id}`, {
            method: 'POST', // or PUT? let's try POST
            headers: { 'content-type': 'application/json', access_token: ASAAS_API_KEY },
            body: JSON.stringify({ value: 19.90 })
        });
        console.log('Update res:', updateRes.status, await updateRes.json());
    }
}

run().catch(console.error);
