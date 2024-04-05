'use client';

import { Button } from '@mantine/core';
import { useCallback } from 'react';
import { useAutocrat } from '../../contexts/AutocratContext';
import { useAutocratDebug } from '../../hooks/useAutocratDebug';

export default function CreateDaoButton() {
  const { autocratProgram, daoTokens } = useAutocrat();
  const { initializeDao } = useAutocratDebug();

  const handleCreateDao = useCallback(async () => {
    await initializeDao();
  }, [autocratProgram, daoTokens]);

  return <Button onClick={() => handleCreateDao()}>Initialize DAO</Button>;
}
