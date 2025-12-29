import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertEmailRequest {
  recipientEmail: string;
  recipientName: string;
  alertType: "vital" | "fall" | "zone";
  alertDetails: {
    title: string;
    message: string;
    vitals?: {
      bpm?: number;
      spo2?: number;
      temperature?: number;
    };
    location?: {
      latitude: number;
      longitude: number;
    };
    timestamp: string;
  };
}

const getAlertIcon = (alertType: string): string => {
  switch (alertType) {
    case "fall":
      return "🚨";
    case "vital":
      return "⚠️";
    case "zone":
      return "📍";
    default:
      return "⚠️";
  }
};

const getAlertColor = (alertType: string): string => {
  switch (alertType) {
    case "fall":
      return "#DC2626"; // Red
    case "vital":
      return "#F59E0B"; // Amber
    case "zone":
      return "#3B82F6"; // Blue
    default:
      return "#F59E0B";
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Send alert email function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmail, recipientName, alertType, alertDetails }: AlertEmailRequest = await req.json();

    console.log(`Sending ${alertType} alert to ${recipientEmail}`);

    const icon = getAlertIcon(alertType);
    const color = getAlertColor(alertType);
    const formattedTime = new Date(alertDetails.timestamp).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      dateStyle: "full",
      timeStyle: "medium",
    });

    let vitalsHtml = "";
    if (alertDetails.vitals) {
      const vitals = alertDetails.vitals;
      vitalsHtml = `
        <div style="background-color: #F3F4F6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 14px;">Chỉ số sinh tồn:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${vitals.bpm ? `<tr><td style="padding: 8px 0; color: #6B7280;">Nhịp tim:</td><td style="padding: 8px 0; font-weight: bold; color: ${vitals.bpm < 60 || vitals.bpm > 100 ? '#DC2626' : '#059669'};">${vitals.bpm} BPM</td></tr>` : ''}
            ${vitals.spo2 ? `<tr><td style="padding: 8px 0; color: #6B7280;">SpO2:</td><td style="padding: 8px 0; font-weight: bold; color: ${vitals.spo2 < 95 ? '#DC2626' : '#059669'};">${vitals.spo2}%</td></tr>` : ''}
            ${vitals.temperature ? `<tr><td style="padding: 8px 0; color: #6B7280;">Nhiệt độ:</td><td style="padding: 8px 0; font-weight: bold; color: ${vitals.temperature < 36 || vitals.temperature > 37.5 ? '#DC2626' : '#059669'};">${vitals.temperature}°C</td></tr>` : ''}
          </table>
        </div>
      `;
    }

    let locationHtml = "";
    if (alertDetails.location) {
      const mapsUrl = `https://www.google.com/maps?q=${alertDetails.location.latitude},${alertDetails.location.longitude}`;
      locationHtml = `
        <div style="margin: 16px 0;">
          <a href="${mapsUrl}" style="display: inline-block; background-color: #3B82F6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
            📍 Xem vị trí trên Google Maps
          </a>
        </div>
      `;
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, ${color} 0%, ${color}CC 100%); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">
              ${icon} ${alertDetails.title}
            </h1>
          </div>
          
          <div style="background-color: white; padding: 24px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #6B7280; margin: 0 0 16px 0;">
              Xin chào <strong>${recipientName}</strong>,
            </p>
            
            <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px;">
              ${alertDetails.message}
            </p>

            ${vitalsHtml}
            ${locationHtml}

            <div style="border-top: 1px solid #E5E7EB; margin-top: 24px; padding-top: 16px;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                ⏰ Thời gian: ${formattedTime}
              </p>
            </div>
          </div>

          <div style="text-align: center; margin-top: 24px;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              Email này được gửi tự động từ hệ thống theo dõi sức khỏe.
            </p>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Health Monitor <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: `${icon} ${alertDetails.title}`,
      html: emailHtml,
    });

    console.log("Email API response:", JSON.stringify(emailResponse));

    // Resend trả về { data, error } - kiểm tra cả hai
    if (emailResponse.error) {
      console.error("Resend error:", emailResponse.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: emailResponse.error.message || "Resend API error",
          details: emailResponse.error,
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully:", emailResponse.data);

    return new Response(JSON.stringify({ success: true, data: emailResponse.data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-alert-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
