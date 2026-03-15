from web3 import Web3

class BlockchainService:

    def __init__(self):
        self.w3       = None
        self.contract = None

    def initialize(self, rpc_url, contract_address, contract_abi):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not self.w3.is_connected():
            raise Exception(f"Cannot connect to blockchain node at {rpc_url}")
        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(contract_address),
            abi=contract_abi
        )
        print(f"  Connected to chain ID {self.w3.eth.chain_id}")

    def _require_ready(self):
        if not self.w3 or not self.contract:
            raise Exception("BlockchainService not initialised")

    def _role_to_string(self, enum_val):
        return {0: 'None', 1: 'Manufacturer', 2: 'Distributor',
                3: 'Retailer', 4: 'Consumer'}.get(enum_val, 'None')

    def _stage_to_string(self, enum_val):
        return {0: 'Registered', 1: 'Manufactured', 2: 'Shipped',
                3: 'Delivered', 4: 'Sold'}.get(enum_val, 'Unknown')

    def get_user_role(self, wallet_address):
        try:
            self._require_ready()
            addr = Web3.to_checksum_address(wallet_address)
            role_enum = self.contract.functions.getRole(addr).call()
            return self._role_to_string(role_enum)
        except Exception as e:
            return {'error': str(e)}

    def get_current_stage(self, product_id):
        try:
            self._require_ready()
            stage_enum = self.contract.functions.getCurrentStage(product_id).call()
            return self._stage_to_string(stage_enum)
        except Exception as e:
            return {'error': str(e)}

    def get_product(self, product_id):
        try:
            self._require_ready()
            result = self.contract.functions.products(product_id).call()
            owner = result[2]
            if owner.lower() == '0x0000000000000000000000000000000000000000':
                return None
            return {
                'product_id': result[0],
                'name':       result[1],
                'owner':      owner,
            }
        except Exception as e:
            print(f"get_product error: {e}")
            return None

    def get_product_history(self, product_id):
        try:
            self._require_ready()
            raw_history = self.contract.functions.getProductHistory(product_id).call()
            return [
                {
                    'stage':           self._stage_to_string(entry[0]),
                    'timestamp':       entry[1],
                    'updater_address': entry[2],
                }
                for entry in raw_history
            ]
        except Exception as e:
            return {'error': str(e)}

    def verify_product_owner(self, product_id, supposed_owner):
        try:
            self._require_ready()
            addr = Web3.to_checksum_address(supposed_owner)
            result = self.contract.functions.verifyProduct(product_id, addr).call()
            return result
        except Exception as e:
            return {'error': str(e)}

    def get_transaction_receipt(self, tx_hash):
        try:
            self._require_ready()
            receipt = self.w3.eth.get_transaction_receipt(tx_hash)
            if receipt is None:
                return None
            return {
                'status':       receipt['status'],
                'block_number': receipt['blockNumber'],
                'gas_used':     receipt['gasUsed'],
                'from_address': receipt['from'],
            }
        except Exception as e:
            print(f"get_transaction_receipt error: {e}")
            return None


# Single shared instance — initialised once when Flask starts
blockchain_service = BlockchainService()