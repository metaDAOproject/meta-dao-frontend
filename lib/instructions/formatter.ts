import { Idl, IdlAccounts } from '@coral-xyz/anchor';
import {
  IdlAccount,
  IdlAccountItem,
  IdlField,
  IdlType,
  IdlTypeDef,
  IdlTypeDefTyStruct,
  IdlTypeDefined,
  IdlTypeOption,
  IdlTypeVec,
} from '@coral-xyz/anchor/dist/cjs/idl';
import { AccountMeta } from '@solana/web3.js';
import camelCase from 'camelcase';
import {
  Instruction,
  InstructionDisplay,
} from '@coral-xyz/anchor/dist/cjs/coder/borsh/instruction';

const sentenceCase = (field: string): string => {
  const result = field.replace(/([A-Z])/g, ' $1');
  return result.charAt(0).toUpperCase() + result.slice(1);
};

/**
 * yanked from @coral-xyz/anchor since it's not exported. some slight modifications
 * to make typesscript compiler happy without no explicit any's turned on.
 *
 * source: https://github.com/coral-xyz/anchor/blob/3e2cd0004c502a985130885dbc2ef297f0e3ac2d/ts/packages/anchor/src/coder/borsh/instruction.ts#L150
 */
export class InstructionFormatter {
  public static format(
    ix: Instruction,
    accountMetas: AccountMeta[],
    idl: Idl,
  ): InstructionDisplay | null {
    const idlIx = idl.instructions.filter((i) => ix.name === i.name)[0];
    if (idlIx === undefined) {
      console.error('Invalid instruction given');
      return null;
    }
    const args = idlIx.args.map((idlField) => ({
      name: idlField.name,
      type: InstructionFormatter.formatIdlType(idlField.type),
      data: InstructionFormatter.formatIdlData(
        idlField,
        ix.data[idlField.name as keyof typeof ix.data],
        idl.types,
      ),
    }));

    const flatIdlAccounts = InstructionFormatter.flattenIdlAccounts(idlIx.accounts);

    const accounts = accountMetas.map((meta, idx) => {
      if (idx < flatIdlAccounts.length) {
        return {
          name: flatIdlAccounts[idx].name,
          ...meta,
        };
      }

      // "Remaining accounts" are unnamed in Anchor.
      return {
        name: undefined,
        ...meta,
      };
    });

    return {
      args,
      accounts,
    };
  }

  private static formatIdlType(idlType: IdlType): string {
    if (typeof idlType === 'string') {
      return idlType as string;
    }

    if ('vec' in idlType) {
      return `Vec<${this.formatIdlType(idlType.vec)}>`;
    }
    if ('option' in idlType) {
      return `Option<${this.formatIdlType(idlType.option)}>`;
    }
    if ('defined' in idlType) {
      return idlType.defined;
    }
    if ('array' in idlType) {
      return `Array<${idlType.array[0]}; ${idlType.array[1]}>`;
    }

    throw new Error(`Unknown IDL type: ${idlType}`);
  }

  private static formatIdlData(idlField: IdlField, data: Object, types?: IdlTypeDef[]): string {
    if (typeof idlField.type === 'string') {
      return typeof data === 'string' ? data : data.toString();
    }
    if (Object.prototype.hasOwnProperty.call(idlField.type, 'vec')) {
      return `[${(<Array<IdlField>>data)
        .map((d: IdlField) =>
          this.formatIdlData({ name: '', type: (<IdlTypeVec>idlField.type).vec }, d),
        )
        .join(', ')}]`;
    }
    if (Object.prototype.hasOwnProperty.call(idlField.type, 'option')) {
      return data === null
        ? 'null'
        : this.formatIdlData(
            { name: '', type: (<IdlTypeOption>idlField.type).option },
            data,
            types,
          );
    }
    if (Object.prototype.hasOwnProperty.call(idlField.type, 'defined')) {
      if (types === undefined) {
        throw new Error('User defined types not provided');
      }
      const filtered = types.filter((t) => t.name === (<IdlTypeDefined>idlField.type).defined);
      if (filtered.length !== 1) {
        throw new Error(`Type not found: ${(<IdlTypeDefined>idlField.type).defined}`);
      }
      return InstructionFormatter.formatIdlDataDefined(filtered[0], data, types);
    }

    return 'unknown';
  }

  private static formatIdlDataDefined(
    typeDef: IdlTypeDef,
    data: Object,
    types: IdlTypeDef[],
  ): string {
    if (typeDef.type.kind === 'struct') {
      const struct: IdlTypeDefTyStruct = typeDef.type;
      const fields = Object.keys(data)
        .map((k) => {
          const field = struct.fields.filter((f) => f.name === k)[0];
          if (field === undefined) {
            throw new Error('Unable to find type');
          }
          return `${k} : ${InstructionFormatter.formatIdlData(
            field,
            data[k as keyof typeof data],
            types,
          )}`;
        })
        .join(', ');

      return `{${fields}}`;
    }

    if (typeDef.type.variants.length === 0) return '{}';
    if (typeDef.type.variants[0].name) {
      const { variants } = typeDef.type;
      const variant = Object.keys(data)[0];
      const enumType = data[variant as keyof typeof data];
      const namedFields = Object.keys(enumType)
        .map((nf) => {
          const fieldData = enumType[nf as keyof typeof enumType];
          // @ts-ignore
          const idlField = variants[variant]?.filter((v: IdlField) => v.name === nf)[0];
          if (idlField === undefined) {
            throw new Error('Unable to find variant');
          }
          return `${nf} : ${InstructionFormatter.formatIdlData(idlField, fieldData, types)}`;
        })
        .join(', ');

      const variantName = camelCase(variant, { pascalCase: true });
      if (namedFields.length === 0) {
        return variantName;
      }
      return `${variantName} { ${namedFields} }`;
    }

    // Tuple enum
    return 'Tuple formatting not yet implemented';
  }

  private static flattenIdlAccounts(accounts: IdlAccountItem[], prefix?: string): IdlAccount[] {
    return accounts
      .map((account) => {
        const accName = sentenceCase(account.name);
        if (Object.prototype.hasOwnProperty.call(account, 'accounts')) {
          const newPrefix = prefix ? `${prefix} > ${accName}` : accName;
          return InstructionFormatter.flattenIdlAccounts(
            // @ts-ignore: todo: fix this.
            (<IdlAccounts>account).accounts,
            newPrefix,
          );
        }

        return {
          ...(<IdlAccount>account),
          name: prefix ? `${prefix} > ${accName}` : accName,
        };
      })
      .flat();
  }
}
