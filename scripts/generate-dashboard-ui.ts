const API_KEY = 'v1:26xzL1Fetn3agA3ROiaUNYTQ:fBw2Cwh8TiDyiUEL9EKM4thK'

const prompt = `
Create a modern Dashboard page for a crypto quantitative trading platform called "Hoot".

## Design Requirements

### Color Theme (Dark Mode - Web3 Style)
- Background: #0A0A0F (main), #12121A (cards), #0D0D14 (sections)
- Primary accent: #06B6D4 (cyan)
- Text: #F8F8FC (primary), #9090A0 (secondary), #606070 (muted)
- Border: #1E1E2E
- Success: emerald/green for positive numbers
- Danger: red for negative numbers

### Layout Structure (Top to Bottom)

1. **Carousel Banner** (Full width, auto-play every 5 seconds)
   - Large banner area with gradient backgrounds
   - Navigation arrows on sides
   - Dot indicators at bottom
   - 4 slides:
     - "新功能上线：AI智能调仓" (New feature)
     - "热门策略推荐：网格交易Pro" (Hot strategy)
     - "邀请好友得 $50 奖励" (Referral promo)
     - "24小时客服在线" (Support)

2. **Marquee Announcement Bar** (Scrolling text)
   - Single line, scrolling from right to left
   - Icon + text format
   - Content: "📢 系统维护通知：1月30日凌晨2点 · 🔥 新策略上线：趋势追踪Pro · 🎁 邀请返佣活动进行中"

3. **Quick Access Cards** (4 cards in a row, 2x2 on mobile)
   - Card 1: 🎯 策略市场 - "发现优质策略"
   - Card 2: 📊 交易中心 - "查看交易记录"
   - Card 3: 💰 钱包资产 - "充值/提现"
   - Card 4: 👥 邀请好友 - "赚取返佣"
   - Each card: icon + title + subtitle, hover effect with cyan glow

4. **Tab Section** (Two tabs)
   - Tab 1 (Default): "市场行情" - Shows crypto prices
     - Grid of 4-6 coins: BTC, ETH, BNB, SOL, XRP, DOGE
     - Each shows: logo, name, price, 24h change (green/red)
   - Tab 2: "行业资讯" - Shows news
     - List of 3-4 news items
     - Each: title, source, time ago
     - Click to read more

### Technical Requirements
- React functional component with TypeScript
- Use useState for carousel index, active tab
- Use useEffect for carousel auto-play, marquee animation
- Tailwind CSS for styling
- Responsive: mobile-first design
- No external dependencies except lucide-react for icons
- Include mock data for all content

### Component Props
interface DashboardV3Props {
  onNavigate?: (path: string) => void
}

Export the component as: export function DashboardV3({ onNavigate }: DashboardV3Props)
`

async function generateDashboard() {
  console.log('Generating Dashboard UI with v0 API...')
  console.log('Prompt length:', prompt.length)

  try {
    const response = await fetch('https://api.v0.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'v0-1.0-md',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', response.status, errorText)
      return
    }

    const data = await response.json()
    console.log('\n=== V0 Response ===\n')
    console.log(JSON.stringify(data, null, 2))

    if (data.choices && data.choices[0]) {
      console.log('\n=== Generated Content ===\n')
      console.log(data.choices[0].message?.content)
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

generateDashboard()
