import { Stack, Table, Text } from '@mantine/core';
import { OpenOrdersAccountWithKey } from '@/lib/types';
import { OpenOrderRow } from './OpenOrderRow';

const headers = ['Order ID', 'Market', 'Claimable', 'Actions'];

export function UncrankedOrdersTab({ orders }: { orders: OpenOrdersAccountWithKey[] }) {
  return (
    <Stack py="md">
      <Text size="sm">
        If you see orders here, you can use the cycle icon with the 12 on it next to the respective
        market which will crank it and push the orders into the Unsettled, Open Accounts below.
      </Text>
      {orders && orders.length > 0 ? (
        <Table>
          <Table.Thead>
            <Table.Tr>
              {headers.map((header) => (
                <Table.Th key={header}>{header}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {orders.map((order) => (
              <OpenOrderRow order={order} />
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text py="sm">No Orders Found</Text>
      )}
    </Stack>
  );
}
