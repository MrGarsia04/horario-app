import { useNavigate, useParams } from 'react-router-dom'
import { useGroupConfig, useSaveGroupConfig } from '../hooks/useGroupData'
import { useBlockModelAvailable } from '../hooks/useSchedules'
import { DEFAULT_CONFIG } from '../lib/timeSlots'
import GroupSettings from '../components/GroupSettings'

export default function GroupConfigPage() {
  const codigo = decodeURIComponent(useParams().codigo ?? '')
  const navigate = useNavigate()
  const config = useGroupConfig(codigo).data ?? DEFAULT_CONFIG
  const save = useSaveGroupConfig(codigo)
  const blockModel = useBlockModelAvailable().data === true
  return (
    <GroupSettings
      config={config}
      blockModel={blockModel}
      onSave={(c) => {
        save.mutate(c)
        navigate(`/g/${codigo}`)
      }}
      onCancel={() => navigate(`/g/${codigo}`)}
    />
  )
}
