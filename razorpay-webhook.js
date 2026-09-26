export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      success: true,
      message: "WOODCRAFT Razorpay webhook receiver is online."
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}


export async function onRequestPost({ request }) {
  try {
    const body = await request.text();

    console.log("Razorpay webhook received");

    return new Response(
      JSON.stringify({
        success: true,
        message: "WOODCRAFT Razorpay webhook received."
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
}
