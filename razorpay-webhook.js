export async function onRequestPost(context) {
  return new Response(
    JSON.stringify({
      success: true,
      message: "WOODCRAFT Razorpay webhook receiver is working."
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
