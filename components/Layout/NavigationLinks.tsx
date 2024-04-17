import { Badge, NavLink } from '@mantine/core';
import { IconHome2, IconFilePlus } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

export function NavigationLinks() {
  const router = useRouter();
  return (
    <>
      <NavLink
        href="#"
        onClick={() => router.push('/')}
        label="Proposals"
        leftSection={<IconHome2 size="1rem" stroke={1.5} />}
        rightSection={
          <Badge>1</Badge>
        }
      />
      <NavLink
        href="#"
        onClick={() => router.push('/create')}
        label="Create Proposal"
        leftSection={<IconFilePlus size="1rem" stroke={1.5} />}
      />
    </>
  );
}
