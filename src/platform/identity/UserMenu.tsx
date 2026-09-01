import { Descriptions, Dropdown, Modal, Button } from 'antd'
import type { MenuProps } from 'antd'
import { DownOutlined, InfoCircleOutlined, LogoutOutlined } from '@ant-design/icons'
import { useState } from 'react'
import type { User } from '../../types'

const systemMetadata = {
  version: '1.0.0',
  githubPageUrl: 'https://github.com/motilahub/middle_platform',
  author: '杨天成',
  contact: '619453767@qq.com',
}

interface UserMenuProps {
  user: User
  onLogout: () => void | Promise<void>
}

export default function UserMenu({ user, onLogout }: UserMenuProps) {
  const [systemInfoOpen, setSystemInfoOpen] = useState(false)
  const items: MenuProps['items'] = [
    { key: 'system-info', icon: <InfoCircleOutlined />, label: '系统信息' },
    { type: 'divider' },
    { key: 'logout', danger: true, icon: <LogoutOutlined />, label: '退出登录' },
  ]
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'system-info') setSystemInfoOpen(true)
    if (key === 'logout') void onLogout()
  }

  return <>
    <Dropdown menu={{ items, onClick: handleMenuClick }} trigger={['click']} placement="bottomRight">
      <Button type="text" className="user-menu-trigger" aria-label="打开用户菜单">
        <span>{user.name}</span><DownOutlined />
      </Button>
    </Dropdown>
    <Modal title="系统信息" open={systemInfoOpen} onCancel={() => setSystemInfoOpen(false)} footer={null} destroyOnClose>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="版本号">{systemMetadata.version}</Descriptions.Item>
        <Descriptions.Item label="GitHub 地址"><a href={systemMetadata.githubPageUrl} target="_blank" rel="noreferrer">motilahub/middle_platform.git</a></Descriptions.Item>
        <Descriptions.Item label="作者">{systemMetadata.author}</Descriptions.Item>
        <Descriptions.Item label="联系方式"><a href={`mailto:${systemMetadata.contact}`}>{systemMetadata.contact}</a></Descriptions.Item>
      </Descriptions>
    </Modal>
  </>
}
