import { Group, Text } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import Link from 'next/link';

export default function ExternalLink({ href, text = 'See more' }: { href: string; text?: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{ width: 'fit-content', alignItems: 'center' }}
      onClick={(e) => e.stopPropagation()}
    >
      <Group gap="6px">
        <Text fw="bold">{text}</Text>
        <IconExternalLink strokeWidth={1} size={18} />
      </Group>
    </Link>
  );
}
