import type { Access, CollectionConfig } from 'payload'

const isAppUser = ({ req }: Parameters<Access>[0]) => (req.user?.collection as string | undefined) === 'users'
const own = (field: string): Access => ({ req }) => {
  const user = req.user
  if (!user || (user.collection as string | undefined) !== 'users') return false
  return { [field]: { equals: user.id } }
}

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'displayName', group: 'สมาชิก' },
  access: {
    create: () => true,
    read: own('id'),
    update: own('id'),
    delete: own('id'),
  },
  fields: [
    { name: 'displayName', type: 'text', required: true },
    { name: 'avatar', type: 'upload', relationTo: 'media' },
    { name: 'coinBalance', type: 'number', defaultValue: 0, access: { create: () => false, update: () => false } },
    { name: 'plan', type: 'select', defaultValue: 'free', options: ['free', 'plus'], access: { create: () => false, update: () => false } },
  ],
}

export const Series: CollectionConfig = {
  slug: 'series',
  admin: { useAsTitle: 'title', group: 'คลังการ์ตูน', defaultColumns: ['title', 'origin', 'status', 'updatedAt'] },
  orderable: true,
  access: {
    read: ({ req }) =>
      req.user?.collection === 'admins' ? true : { _status: { equals: 'published' } },
  },
  versions: { drafts: true },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'slug', useAsSlug: 'title' },
    { name: 'subtitle', type: 'text' },
    { name: 'synopsis', type: 'textarea', required: true },
    { name: 'cover', type: 'upload', relationTo: 'media' },
    { name: 'origin', type: 'select', required: true, options: [{ label: 'เกาหลี', value: 'korea' }, { label: 'จีน', value: 'china' }, { label: 'ญี่ปุ่น', value: 'japan' }] },
    { name: 'status', type: 'select', required: true, defaultValue: 'ongoing', options: ['ongoing', 'completed', 'hiatus'] },
    { name: 'genres', type: 'select', hasMany: true, options: ['action', 'fantasy', 'romance', 'drama', 'comedy', 'historical'] },
    { name: 'rating', type: 'number', min: 0, max: 5, defaultValue: 0 },
    { name: 'author', type: 'text', required: true },
  ],
}

export const Chapters: CollectionConfig = {
  slug: 'chapters',
  admin: { useAsTitle: 'title', group: 'คลังการ์ตูน' },
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'series', type: 'relationship', relationTo: 'series' as any, required: true, index: true },
    { name: 'chapterNumber', type: 'number', required: true, min: 0 },
    { name: 'coinPrice', type: 'number', required: true, min: 0, defaultValue: 0 },
    { name: 'isPreview', type: 'checkbox', defaultValue: false },
    { name: 'publishedAt', type: 'date', required: true },
    { name: 'pages', type: 'array', fields: [{ name: 'image', type: 'upload', relationTo: 'media', required: true }] },
  ],
}

export const Library: CollectionConfig = {
  slug: 'library',
  admin: { group: 'สมาชิก' },
  access: { create: isAppUser, read: own('user'), update: own('user'), delete: own('user') },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users' as any, required: true, access: { create: () => false, update: () => false } },
    { name: 'series', type: 'relationship', relationTo: 'series' as any, required: true },
    { name: 'notifications', type: 'checkbox', defaultValue: true },
  ],
}

export const ReadingProgress: CollectionConfig = {
  slug: 'reading-progress',
  admin: { group: 'สมาชิก' },
  access: { create: isAppUser, read: own('user'), update: own('user'), delete: own('user') },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users' as any, required: true, access: { create: () => false, update: () => false } },
    { name: 'series', type: 'relationship', relationTo: 'series' as any, required: true },
    { name: 'chapter', type: 'relationship', relationTo: 'chapters' as any, required: true },
    { name: 'page', type: 'number', min: 1, defaultValue: 1 },
    { name: 'percent', type: 'number', min: 0, max: 100, defaultValue: 0 },
  ],
}

export const Purchases: CollectionConfig = {
  slug: 'purchases',
  admin: { group: 'การเงิน' },
  access: { create: isAppUser, read: own('user'), update: () => false, delete: () => false },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users' as any, required: true, access: { create: () => false, update: () => false } },
    { name: 'chapter', type: 'relationship', relationTo: 'chapters' as any, required: true },
    { name: 'coinsPaid', type: 'number', required: true, min: 0 },
    { name: 'purchasedAt', type: 'date', required: true },
  ],
}

export const WalletTransactions: CollectionConfig = {
  slug: 'wallet-transactions',
  admin: { useAsTitle: 'reference', group: 'การเงิน' },
  access: { create: () => false, read: own('user'), update: () => false, delete: () => false },
  fields: [
    { name: 'reference', type: 'text', required: true, unique: true, index: true },
    { name: 'user', type: 'relationship', relationTo: 'users' as any, required: true },
    { name: 'type', type: 'select', required: true, options: ['topup', 'purchase', 'refund', 'bonus'] },
    { name: 'coins', type: 'number', required: true },
    { name: 'amountTHB', type: 'number', min: 0 },
    { name: 'status', type: 'select', required: true, options: ['pending', 'completed', 'failed'], defaultValue: 'pending' },
    { name: 'provider', type: 'select', options: ['promptpay', 'card', 'mobile-banking', 'system'] },
  ],
}
