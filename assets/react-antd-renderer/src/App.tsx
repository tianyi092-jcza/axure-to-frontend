import { ConfigProvider, theme } from 'antd'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AxureRenderer } from './components/AxureRenderer'
import { axurePages } from './data/axurePages'

function CurrentPage() {
  const location = useLocation()
  const page = axurePages.find((candidate) => candidate.route === location.pathname)

  if (!page) return <Navigate to="/" replace />
  return <AxureRenderer page={page} pages={axurePages} />
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#f2f2f2',
          colorBgBase: '#000000',
          colorTextBase: '#f2f2f2',
          borderRadius: 4,
          fontFamily: 'Inter, Arial, sans-serif',
        },
      }}
    >
      <Routes>
        {axurePages.map((page) => (
          <Route key={page.pageKey} path={page.route} element={<CurrentPage />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConfigProvider>
  )
}
