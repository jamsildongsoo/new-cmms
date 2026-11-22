import { http } from '@/shared/api/http'
import type { UserProfile } from './user-profile.types'

export async function getProfile() {
  return (await http.get<UserProfile>('/users/me/profile')).data
}
export async function updateProfile(payload: {
  email: string | null
  phoneNumber: string | null
}) {
  return (await http.patch<UserProfile>('/users/me/profile', payload)).data
}
export async function changePassword(payload: {
  currentPassword: string
  newPassword: string
}) {
  return (await http.patch<{ message: string }>('/users/me/password', payload))
    .data
}
