"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getDashboardStats,
  getDailyActiveUsers,
  getDailyRevenue,
  type DashboardStats,
  type DailyStats,
  type RevenueStats,
} from "@/actions/admin-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  RefreshCw,
  Users,
  DollarSign,
  Activity,
  CreditCard,
  Calendar,
  Globe,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function StatsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"all" | "global" | "cn">("all");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyUsers, setDailyUsers] = useState<DailyStats[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<RevenueStats[]>([]);
  const [timeRange, setTimeRange] = useState<number>(30);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, usersResult, revenueResult] = await Promise.all([
        getDashboardStats(source),
        getDailyActiveUsers(source, timeRange),
        getDailyRevenue(source, timeRange),
      ]);

      if (statsResult) {
        setStats(statsResult);
      } else {
        setError("获取统计数据失败");
      }
      setDailyUsers(usersResult);
      setDailyRevenue(revenueResult);
    } catch {
      setError("加载统计数据失败");
    } finally {
      setLoading(false);
    }
  }, [source, timeRange]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  // 准备设备分布数据
  const deviceData = useMemo(() => {
    if (!stats?.devices.byDeviceType) return [];
    return Object.entries(stats.devices.byDeviceType).map(([name, value]) => ({
      name: name === "desktop" ? "桌面" : name === "mobile" ? "手机" : name === "tablet" ? "平板" : name,
      value,
    }));
  }, [stats]);

  // 准备操作系统分布数据
  const osData = useMemo(() => {
    if (!stats?.devices.byOs) return [];
    return Object.entries(stats.devices.byOs).map(([name, value]) => ({ name, value }));
  }, [stats]);

  // 准备订阅计划分布数据
  const planData = useMemo(() => {
    if (!stats?.subscriptions.byPlan) return [];
    return Object.entries(stats.subscriptions.byPlan).map(([name, value]) => ({ name, value }));
  }, [stats]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* 页头 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">用户数据统计</h1>
          <p className="text-sm text-muted-foreground mt-1">
            查看用户、付费、设备等统计数据
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
            <SelectTrigger className="w-[140px]">
              <Globe className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部数据</SelectItem>
              <SelectItem value="global">国际版</SelectItem>
              <SelectItem value="cn">国内版</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={loadStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !stats ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">总用户数</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats.users.total)}</div>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">今日</span>
                    <span className="font-semibold text-green-600">+{formatNumber(stats.users.today)}</span>
                  </div>
                  <div className="w-px h-6 bg-border" />
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">本周</span>
                    <span className="font-semibold text-blue-600">+{formatNumber(stats.users.thisWeek)}</span>
                  </div>
                  <div className="w-px h-6 bg-border" />
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">本月</span>
                    <span className="font-semibold text-purple-600">+{formatNumber(stats.users.thisMonth)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">日活跃用户</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats.users.dau)}</div>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">周活</span>
                    <span className="font-semibold text-green-600">{formatNumber(stats.users.wau)}</span>
                  </div>
                  <div className="w-px h-6 bg-border" />
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">月活</span>
                    <span className="font-semibold text-purple-600">{formatNumber(stats.users.mau)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">总收入</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {source === "all" ? (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                      <span className="text-xl sm:text-2xl font-bold">${stats.revenue.total.toFixed(2)}</span>
                      <span className="text-base sm:text-lg font-semibold text-muted-foreground hidden sm:inline">+</span>
                      <span className="text-xl sm:text-2xl font-bold">¥{stats.revenueCny.total.toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">美元今日</span>
                        <span className="font-semibold text-green-600">+${stats.revenue.today.toFixed(2)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">人民币今日</span>
                        <span className="font-semibold text-red-600">+¥{stats.revenueCny.today.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                ) : source === "cn" ? (
                  <>
                    <div className="text-2xl font-bold">¥{stats.revenueCny.total.toFixed(2)}</div>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">今日</span>
                        <span className="font-semibold text-green-600">+¥{stats.revenueCny.today.toFixed(2)}</span>
                      </div>
                      <div className="w-px h-6 bg-border" />
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">本周</span>
                        <span className="font-semibold text-blue-600">+¥{stats.revenueCny.thisWeek.toFixed(2)}</span>
                      </div>
                      <div className="w-px h-6 bg-border" />
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">本月</span>
                        <span className="font-semibold text-purple-600">+¥{stats.revenueCny.thisMonth.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">${stats.revenue.total.toFixed(2)}</div>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">今日</span>
                        <span className="font-semibold text-green-600">+${stats.revenue.today.toFixed(2)}</span>
                      </div>
                      <div className="w-px h-6 bg-border" />
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">本周</span>
                        <span className="font-semibold text-blue-600">+${stats.revenue.thisWeek.toFixed(2)}</span>
                      </div>
                      <div className="w-px h-6 bg-border" />
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">本月</span>
                        <span className="font-semibold text-purple-600">+${stats.revenue.thisMonth.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">订阅用户</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats.subscriptions.total)}</div>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">转化率</span>
                    <span className="font-semibold text-green-600">{stats.users.total > 0 ? ((stats.subscriptions.total / stats.users.total) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <div className="w-px h-6 bg-border" />
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">已付款</span>
                    <span className="font-semibold text-blue-600">{formatNumber(stats.orders.paid)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ��表区域 */}
          <Tabs defaultValue="users" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <TabsList className="inline-flex w-max sm:w-auto">
                  <TabsTrigger value="users" className="text-xs sm:text-sm">用户趋势</TabsTrigger>
                  <TabsTrigger value="revenue" className="text-xs sm:text-sm">收入趋势</TabsTrigger>
                  <TabsTrigger value="devices" className="text-xs sm:text-sm">设备分布</TabsTrigger>
                  <TabsTrigger value="plans" className="text-xs sm:text-sm">订阅分布</TabsTrigger>
                </TabsList>
              </div>

              <Select
                value={timeRange.toString()}
                onValueChange={(v) => setTimeRange(Number(v))}
              >
                <SelectTrigger className="w-full sm:w-[150px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">最近 7 天</SelectItem>
                  <SelectItem value="14">最近 14 天</SelectItem>
                  <SelectItem value="30">最近 30 天</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 用户趋势图 */}
            <TabsContent value="users">
              <Card>
                <CardHeader className="pb-2 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg">活跃用户趋势</CardTitle>
                </CardHeader>
                <CardContent className="px-2 sm:px-6">
                  <div className="h-[250px] sm:h-[350px]">
                    {dailyUsers.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyUsers}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} className="text-xs" interval={1} angle={-45} textAnchor="end" height={60} />
                          <YAxis className="text-xs" allowDecimals={false} domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                            formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                            labelFormatter={(label) => `日期: ${label}`}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="activeUsers" name="活跃用户" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                          <Line type="monotone" dataKey="newUsers" name="新增用户" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                          <Line type="monotone" dataKey="sessions" name="构建数" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">暂无数据</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 收入趋势图 */}
            <TabsContent value="revenue">
              <Card>
                <CardHeader className="pb-2 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg">收入趋势</CardTitle>
                </CardHeader>
                <CardContent className="px-2 sm:px-6">
                  <div className="h-[250px] sm:h-[350px]">
                    {dailyRevenue.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyRevenue}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} className="text-xs" />
                          <YAxis className="text-xs" domain={[0, 300]} />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload || !payload.length) return null;
                              return (
                                <div
                                  style={{
                                    backgroundColor: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    padding: "12px",
                                    color: "hsl(var(--foreground))",
                                  }}
                                >
                                  <p style={{ marginBottom: "8px", fontWeight: 500 }}>日期: {label}</p>
                                  {payload.map((entry: any, index: number) => (
                                    <p key={index} style={{ margin: "4px 0", color: "hsl(var(--foreground))" }}>
                                      <span style={{ fontWeight: 500 }}>{entry.name}:</span>{" "}
                                      <span style={{ fontWeight: 600 }}>
                                        {entry.name.includes("美元") || entry.name.includes("$")
                                          ? `$${entry.value.toFixed(2)}`
                                          : `¥${entry.value.toFixed(2)}`}
                                      </span>
                                    </p>
                                  ))}
                                </div>
                              );
                            }}
                          />
                          <Legend />
                          {(source === "all" || source === "global") && (
                            <Bar dataKey="amount" name={source === "all" ? "美元收入 ($)" : "收入金额 ($)"} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          )}
                          {(source === "all" || source === "cn") && (
                            <Bar dataKey="amountCny" name={source === "all" ? "人民币收入 (¥)" : "收入金额 (¥)"} fill="#ef4444" radius={[4, 4, 0, 0]} />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">暂无数据</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 设备分布 */}
            <TabsContent value="devices">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2 sm:pb-6">
                    <CardTitle className="text-base sm:text-lg">设备类型分布</CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-6">
                    <div className="h-[220px] sm:h-[300px]">
                      {deviceData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={deviceData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                            >
                              {deviceData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                              formatter={(value: number) => [value.toLocaleString(), "用户数"]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">暂无设备数据</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 sm:pb-6">
                    <CardTitle className="text-base sm:text-lg">操作系统分布</CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-6">
                    <div className="h-[220px] sm:h-[300px]">
                      {osData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={osData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                            >
                              {osData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                              formatter={(value: number) => [value.toLocaleString(), "用户数"]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">暂无系统数据</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* 订阅分布 */}
            <TabsContent value="plans">
              <Card>
                <CardHeader className="pb-2 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg">订阅计划分布</CardTitle>
                </CardHeader>
                <CardContent className="px-2 sm:px-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="h-[220px] sm:h-[300px]">
                      {planData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={planData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                            >
                              {planData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                              formatter={(value: number) => [value.toLocaleString(), "订阅数"]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">暂无订阅数据</div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                        <span className="text-sm font-medium">总订阅数</span>
                        <span className="text-2xl font-bold">{stats.subscriptions.total}</span>
                      </div>
                      <div className="space-y-2">
                        {planData.map((plan, index) => (
                          <div key={plan.name} className="flex justify-between items-center p-2 rounded">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-sm">{plan.name}</span>
                            </div>
                            <span className="font-medium">{plan.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
