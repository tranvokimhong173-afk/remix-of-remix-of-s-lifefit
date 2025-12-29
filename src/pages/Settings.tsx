import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Header from "@/components/Header";
import { ArrowLeft, Loader2, MapPin, Shield, LocateFixed, Phone, Mail, MessageSquare, TestTube } from "lucide-react";
import { Link } from "react-router-dom";
import { saveUserProfile } from "@/services/userProfileService";
import { useState, useEffect, useMemo } from "react";
import { GoogleMap, Circle, Marker } from "@react-google-maps/api";
import { getUserProfile } from "@/services/userProfileService";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { useEmailAlert } from "@/hooks/useEmailAlert";
import { useSmsAlert } from "@/hooks/useSmsAlert";
import { supabase } from "@/integrations/supabase/client";
const formSchema = z.object({
  name: z.string().min(1, "Tên không được để trống").max(100, "Tên không được quá 100 ký tự"),
  age: z.coerce.number().min(1, "Tuổi phải lớn hơn 0").max(150, "Tuổi không hợp lệ"),
  email: z.string().email("Định dạng email không hợp lệ"),
  emergencyContact: z.string()
    .regex(/^(\+84|0)[0-9]{9,10}$/, "Số điện thoại không hợp lệ (VD: 0912345678 hoặc +84912345678)")
    .optional()
    .or(z.literal("")),
  gender: z.enum(["male", "female", "other"], {
    required_error: "Vui lòng chọn giới tính",
  }),
  medicalConditions: z.array(z.string()).optional(),
  // Safe zone settings
  safeZoneCenterLat: z.coerce.number().min(-90).max(90).optional(),
  safeZoneCenterLng: z.coerce.number().min(-180).max(180).optional(),
  safeZoneRadius: z.coerce.number().min(10, "Bán kính tối thiểu 10m").max(10000, "Bán kính tối đa 10km").optional(),
});

const medicalConditions = [
  { id: "cardiovascular", label: "Bệnh tim mạch" },
  { id: "diabetes", label: "Tiểu đường" },
  { id: "hypertension", label: "Huyết áp cao" },
  { id: "respiratory", label: "Bệnh hô hấp mãn tính" },
];

const Settings = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);
  // Fixed device ID for user profile
  const userId = "device1";

  const { isLoaded } = useGoogleMaps();
  const { sendAlertEmail } = useEmailAlert(userId);
  const { forceSendSms, checkNetworkStatus } = useSmsAlert(userId);

  const handleTestEmail = async () => {
    // Lấy email hiện tại từ form (chưa lưu cũng test được)
    const currentEmail = form.getValues('email');
    const currentName = form.getValues('name') || 'Người dùng';

    if (!currentEmail) {
      toast.error('Vui lòng nhập địa chỉ email trước khi test');
      return;
    }

    setIsSendingTestEmail(true);
    try {
      // Gọi trực tiếp edge function với email từ form
      const { data, error } = await supabase.functions.invoke('send-alert-email', {
        body: {
          recipientEmail: currentEmail,
          recipientName: currentName,
          alertType: 'vital',
          alertDetails: {
            title: '🧪 TEST: Kiểm tra gửi email cảnh báo',
            message: 'Đây là email thử nghiệm từ ứng dụng S-Life. Nếu bạn nhận được email này, tính năng cảnh báo qua email đang hoạt động bình thường.',
            vitals: { bpm: 75, spo2: 98, temperature: 36.5 },
            timestamp: new Date().toISOString(),
          },
        },
      });

      if (error) {
        console.error('Lỗi kết nối server:', error);
        toast.error('Lỗi kết nối server gửi email');
        return;
      }

      if (data?.success === false) {
        console.error('Email send failed:', data.error, data.details);
        toast.error('Không thể gửi email', {
          description: data.error || 'Kiểm tra RESEND_API_KEY và domain đã xác minh.',
        });
        return;
      }

      toast.success('Email thử nghiệm đã được gửi!', {
        description: `Kiểm tra hộp thư ${currentEmail}`,
      });
    } catch (error: any) {
      console.error('Lỗi gửi email test:', error);
      toast.error('Lỗi khi gửi email thử nghiệm', { description: error?.message });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleTestSms = async () => {
    setIsSendingTestSms(true);
    try {
      // Check if running on native platform
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) {
        toast.error('SMS chỉ hoạt động trên ứng dụng Android', {
          description: 'Vui lòng build app và cài đặt trên thiết bị Android để test SMS.',
        });
        setIsSendingTestSms(false);
        return;
      }

      const success = await forceSendSms(
        'vital',
        '🧪 TEST: Kiểm tra SMS',
        'Đây là tin nhắn thử nghiệm từ S-Life.',
        { bpm: 75, spo2: 98, temperature: 36.5 },
        undefined
      );
      if (success) {
        toast.success('Đã gửi yêu cầu SMS!', {
          description: 'Nếu máy không tự gửi, ứng dụng/hệ điều hành có thể đang chặn gửi SMS tự động.',
        });
      } else {
        toast.error('Không thể gửi SMS.', {
          description: 'Kiểm tra: (1) đã lưu số điện thoại khẩn cấp, (2) máy có SIM & SMS hoạt động, (3) quyền SMS đã được cấp.',
        });
      }
    } catch (error) {
      console.error('Lỗi gửi SMS test:', error);
      toast.error('Lỗi khi gửi SMS thử nghiệm');
    } finally {
      setIsSendingTestSms(false);
    }
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      age: 0,
      email: "",
      emergencyContact: "",
      gender: undefined,
      medicalConditions: [],
      safeZoneCenterLat: 10.762622,
      safeZoneCenterLng: 106.660172,
      safeZoneRadius: 100,
    },
  });

  const watchedLat = form.watch("safeZoneCenterLat");
  const watchedLng = form.watch("safeZoneCenterLng");
  const watchedRadius = form.watch("safeZoneRadius");

  const mapCenter = useMemo(() => ({
    lat: watchedLat || 10.762622,
    lng: watchedLng || 106.660172,
  }), [watchedLat, watchedLng]);

  const safeZoneRadius = watchedRadius || 100;

  // Load existing profile data
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await getUserProfile(userId);
        if (profile) {
          form.reset({
            name: profile.name,
            age: profile.age,
            email: profile.email,
            emergencyContact: profile.emergencyContact || "",
            gender: profile.gender,
            medicalConditions: Object.entries(profile.conditions)
              .filter(([_, value]) => value)
              .map(([key]) => key),
            safeZoneCenterLat: profile.safeZone?.centerLat ?? 10.762622,
            safeZoneCenterLng: profile.safeZone?.centerLng ?? 106.660172,
            safeZoneRadius: profile.safeZone?.radiusMeters ?? 100,
          });
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      }
    };
    loadProfile();
  }, [userId, form]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt không hỗ trợ định vị GPS");
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue("safeZoneCenterLat", position.coords.latitude);
        form.setValue("safeZoneCenterLng", position.coords.longitude);
        toast.success("Đã lấy vị trí hiện tại thành công!");
        setIsGettingLocation(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        let message = "Không thể lấy vị trí hiện tại";
        if (error.code === error.PERMISSION_DENIED) {
          message = "Bạn đã từ chối quyền truy cập vị trí";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = "Không thể xác định vị trí";
        } else if (error.code === error.TIMEOUT) {
          message = "Hết thời gian chờ lấy vị trí";
        }
        toast.error(message);
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const profileData = {
        name: values.name,
        age: values.age,
        email: values.email,
        emergencyContact: values.emergencyContact || undefined,
        gender: values.gender,
        conditions: {
          cardiovascular: values.medicalConditions?.includes("cardiovascular") || false,
          diabetes: values.medicalConditions?.includes("diabetes") || false,
          hypertension: values.medicalConditions?.includes("hypertension") || false,
          respiratory: values.medicalConditions?.includes("respiratory") || false,
        },
        safeZone: {
          centerLat: values.safeZoneCenterLat ?? 10.762622,
          centerLng: values.safeZoneCenterLng ?? 106.660172,
          radiusMeters: values.safeZoneRadius ?? 100,
        },
      };

      // Save to Firebase
      await saveUserProfile(userId, profileData);
      
      // Prepare data for AI analysis
      const analysisData = {
        userId: userId,
        age: values.age,
        underlyingConditions: {
          cardiovascular: values.medicalConditions?.includes("cardiovascular") || false,
          diabetes: values.medicalConditions?.includes("diabetes") || false,
          hypertension: values.medicalConditions?.includes("hypertension") || false,
          respiratory: values.medicalConditions?.includes("respiratory") || false,
        },
        currentData: {
          heartRate: 0,
          temperature: 36.5,
          speed: 0.0,
          distance: 0.0,
          movement: "Đang dừng yên"
        },
        history: [
          {
            timestamp: new Date().toISOString(),
            heartRate: 0,
            temperature: 36.5
          }
        ]
      };

      // Send to AI analysis endpoint
      try {
        const response = await fetch("https://health-ai-project-4w0w6wcbv-kim-hongs-projects.vercel.app/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(analysisData),
        });

        if (response.ok) {
          toast.success("Phân tích đã gửi thành công!", {
            description: "Dữ liệu của bạn đã được gửi để phân tích AI.",
          });
        } else {
          console.error("AI analysis failed:", await response.text());
        }
      } catch (analysisError) {
        console.error("Error sending to AI analysis:", analysisError);
        // Don't show error to user for analysis failure
      }
      
      toast.success("Cập nhật thông tin thành công!", {
        description: "Thông tin cá nhân và vùng an toàn đã được lưu.",
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Lỗi khi lưu thông tin!", {
        description: "Vui lòng thử lại sau.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header userId={userId} />
      <div className="container mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Quay lại trang chủ
        </Link>

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Personal Info Card */}
          <div className="bg-card rounded-lg shadow-card p-6 md:p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">Cài đặt thông tin cá nhân</h2>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tên</FormLabel>
                      <FormControl>
                        <Input placeholder="Nhập tên của bạn" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tuổi</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Nhập tuổi" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Địa chỉ Gmail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="example@gmail.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emergencyContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-primary" />
                        Số điện thoại khẩn cấp (nhận SMS cảnh báo)
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="tel" 
                          placeholder="0912345678 hoặc +84912345678" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Số điện thoại sẽ nhận SMS cảnh báo khi không có internet
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Giới tính</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="male" />
                            </FormControl>
                            <FormLabel className="font-normal">Nam</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="female" />
                            </FormControl>
                            <FormLabel className="font-normal">Nữ</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="other" />
                            </FormControl>
                            <FormLabel className="font-normal">Khác</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="medicalConditions"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">Bệnh nền</FormLabel>
                      </div>
                      {medicalConditions.map((condition) => (
                        <FormField
                          key={condition.id}
                          control={form.control}
                          name="medicalConditions"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={condition.id}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(condition.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), condition.id])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== condition.id
                                            )
                                          );
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {condition.label}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Safe Zone Settings */}
                <div className="border-t border-border pt-6 mt-6">
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                        <Shield className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <h3 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                        Cài đặt vùng an toàn
                      </h3>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={getCurrentLocation}
                      disabled={isGettingLocation}
                      className="gap-2"
                    >
                      {isGettingLocation ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LocateFixed className="h-4 w-4" />
                      )}
                      {isGettingLocation ? "Đang lấy..." : "Lấy vị trí hiện tại"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="safeZoneCenterLat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            Vĩ độ tâm (Latitude)
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.000001"
                              placeholder="10.762622" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Từ -90 đến 90
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="safeZoneCenterLng"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            Kinh độ tâm (Longitude)
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.000001"
                              placeholder="106.660172" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Từ -180 đến 180
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="safeZoneRadius"
                    render={({ field }) => (
                      <FormItem className="mt-4">
                        <FormLabel className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          Bán kính vùng an toàn (mét)
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={10}
                            max={10000}
                            placeholder="100" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Từ 10m đến 10,000m (10km)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Map Preview */}
                  <div className="mt-6">
                    <FormLabel className="flex items-center gap-2 mb-3">
                      <MapPin className="h-4 w-4 text-primary" />
                      Xem trước vùng an toàn
                    </FormLabel>
                    <div className="rounded-xl overflow-hidden border border-border shadow-md h-[250px]">
                      {isLoaded ? (
                        <GoogleMap
                          mapContainerStyle={{ width: '100%', height: '100%' }}
                          center={mapCenter}
                          zoom={15}
                          options={{
                            disableDefaultUI: true,
                            zoomControl: true,
                            mapTypeControl: false,
                            streetViewControl: false,
                            fullscreenControl: false,
                          }}
                        >
                          <Circle
                            center={mapCenter}
                            radius={safeZoneRadius}
                            options={{
                              fillColor: "#14b8a6",
                              fillOpacity: 0.2,
                              strokeColor: "#14b8a6",
                              strokeOpacity: 0.8,
                              strokeWeight: 2,
                            }}
                          />
                          <Marker
                            position={mapCenter}
                            draggable={true}
                            onDragEnd={(e) => {
                              if (e.latLng) {
                                form.setValue("safeZoneCenterLat", e.latLng.lat());
                                form.setValue("safeZoneCenterLng", e.latLng.lng());
                              }
                            }}
                            icon={window.google ? {
                              path: window.google.maps.SymbolPath.CIRCLE,
                              scale: 10,
                              fillColor: "#14b8a6",
                              fillOpacity: 1,
                              strokeColor: "#ffffff",
                              strokeWeight: 3,
                            } : undefined}
                          />
                        </GoogleMap>
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Kéo thả marker để chọn vị trí tâm. Vùng màu xanh hiển thị phạm vi an toàn với bán kính {safeZoneRadius}m
                    </p>
                  </div>
                </div>

                {/* Test Alert Section */}
                <div className="border-t border-border pt-6 mt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                      <TestTube className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                      Kiểm tra cảnh báo
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Gửi thông báo thử nghiệm để kiểm tra tính năng cảnh báo email và SMS hoạt động đúng.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestEmail}
                      disabled={isSendingTestEmail}
                      className="gap-2"
                    >
                      {isSendingTestEmail ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                      {isSendingTestEmail ? "Đang gửi..." : "Gửi Email thử"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestSms}
                      disabled={isSendingTestSms}
                      className="gap-2"
                    >
                      {isSendingTestSms ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                      {isSendingTestSms ? "Đang gửi..." : "Gửi SMS thử"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    * SMS chỉ hoạt động trên thiết bị Android. Email cần có kết nối internet.
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLoading ? "Đang lưu..." : "Cập nhật thông tin"}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
