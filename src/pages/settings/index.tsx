import ChevronDownIcon from "@/assets/icons/ChevronDownIcon";
import Toast from "@/components/Toast";
import { useAccountState } from "@/store/account.store";
import { useSettingsState } from "@/store/settings.store";
import Link from "next/link";
import React, { useEffect, useState } from "react";

const Settings: React.FC = () => {
	const [showPassword, setShowPassword] = useState(false);
	const [showToast, setShowToast] = useState(false);
	const [isOpen, setIsOpen] = useState(false);

	const {
		apiKey,
		fundingWif,
		tokenReceiveAddress,
		rateLimit,
		bidExpiration,
		defaultOutbidMargin,
		defaultLoopTime,
		updateSettings,
	} = useSettingsState();

	const [formState, setFormState] = useState<SettingsState>({
		apiKey: apiKey,
		fundingWif: fundingWif,
		tokenReceiveAddress: tokenReceiveAddress,
		rateLimit: rateLimit,
		bidExpiration: bidExpiration,
		defaultOutbidMargin: defaultOutbidMargin,
		defaultLoopTime: defaultLoopTime,
	});

	useEffect(() => {
		setFormState({
			apiKey: apiKey,
			fundingWif: fundingWif,
			tokenReceiveAddress: tokenReceiveAddress,
			rateLimit: rateLimit,
			bidExpiration: bidExpiration,
			defaultOutbidMargin: defaultOutbidMargin,
			defaultLoopTime: defaultLoopTime,
		});
	}, [
		apiKey,
		bidExpiration,
		defaultLoopTime,
		defaultOutbidMargin,
		fundingWif,
		rateLimit,
		tokenReceiveAddress,
	]);

	const togglePasswordVisibility = () => {
		setShowPassword(!showPassword);
	};

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement>,
		field: keyof SettingsState
	) => {
		const value = e.target.value;
		setFormState((prevState) => ({
			...prevState,
			[field]: value,
		}));

		updateSettings({ [field]: value });
	};

	const handleNumberInputChange = (
		e: React.ChangeEvent<HTMLInputElement>,
		field: keyof SettingsState
	) => {
		const value = e.target.value;
		if (value === "" || (Number(value) >= 0 && Number(value) < Infinity)) {
			setFormState((prevState) => ({
				...prevState,
				[field]: value,
			}));
		}

		updateSettings({ [field]: Number(value) });
	};

	function saveSettings() {
		setShowToast(true);
	}

	const { wallets } = useAccountState();
	const [selectedWallet, setSelectedWallet] = useState("");

	const handleWalletChange = (address: string) => {
		const foundWallet = wallets.find(
			(item) => item.address.toLowerCase() === address.toLowerCase()
		);

		if (foundWallet) {
			updateSettings({ fundingWif: foundWallet.privateKey });
			setSelectedWallet(address);
		}

		setIsOpen(false);
	};

	const toggleDropdown = () => {
		setIsOpen(!isOpen);
	};

	return (
		<div className='py-[30px] px-[40px]'>
			{showToast && (
				<Toast
					id='toast-success'
					icon={
						<svg
							className='w-5 h-5'
							aria-hidden='true'
							xmlns='http://www.w3.org/2000/svg'
							fill='currentColor'
							viewBox='0 0 20 20'>
							<path d='M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z' />
						</svg>
					}
					text='Settings saved successfully.'
				/>
			)}
			<h2 className='text-white text-[20px] font-semibold'>Settings</h2>
			<p className='mt-2 text-[14px] font-medium text-[#AEB9E1]'>
				Default bidding configuration
			</p>

			<div className='mt-6 md:w-[768px] border border-[#343B4F] rounded-xl p-8 bg-[#0b1739]'>
				<div>
					<label
						htmlFor='api_key'
						className='block mb-2 text-sm font-medium text-white'>
						API KEY
					</label>
					<input
						type='text'
						id='api_key'
						className='p-[14px] bg-transparent border border-[#343B4F] w-full rounded text-white'
						placeholder=''
						value={formState.apiKey}
						onChange={(e) => handleInputChange(e, "apiKey")}
						required
					/>
				</div>

				{/* select wallets */}
				<div className='mt-6 relative'>
					<label
						htmlFor='funding_wif'
						className='block mb-2 text-sm font-medium text-white'>
						FUNDING WALLET
					</label>
					<div className='relative'>
						<button
							type='button'
							className='p-[14px] bg-transparent border border-[#343B4F] w-full rounded text-white flex items-center justify-between'
							onClick={toggleDropdown}>
							<span className={selectedWallet ? "text-white" : "text-gray-400"}>
								{selectedWallet
									? wallets.find((wallet) => wallet.address === selectedWallet)
											?.address
									: "Select a wallet"}
							</span>
							<ChevronDownIcon
								className={`w-5 h-5 ml-2 transition-transform ${
									isOpen ? "transform rotate-180" : ""
								}`}
							/>
						</button>
						{isOpen && (
							<div className='absolute z-10 w-full bg-[#1A2342] border border-[#343B4F] rounded shadow-lg mt-1'>
								{wallets.map((wallet, index) => (
									<div
										key={index}
										className={`p-[14px] text-white cursor-pointer hover:bg-[#343B4F] ${
											selectedWallet === wallet.privateKey ? "bg-[#343B4F]" : ""
										}`}
										onClick={() => handleWalletChange(wallet.address)}>
										{wallet.address}
									</div>
								))}
							</div>
						)}
					</div>
					<div className='mt-2'>
						<Link href='/accounts' className='text-white underline'>
							Add a new key
						</Link>
					</div>
				</div>
				<div className='mt-6'>
					<label
						htmlFor='token_receive_address'
						className='block mb-2 text-sm font-medium text-white'>
						TOKEN RECEIVE ADDRESS
					</label>
					<input
						type='text'
						id='token_receive_address'
						className='p-[14px] bg-transparent border border-[#343B4F] w-full rounded text-white'
						placeholder=''
						value={formState.tokenReceiveAddress}
						onChange={(e) => handleInputChange(e, "tokenReceiveAddress")}
						required
					/>
				</div>

				{/* timers */}
				<div className='mt-6 flex flex-col md:flex-row md:space-x-4'>
					<div>
						<label
							htmlFor='default_loop_time'
							className='block mb-2 text-sm font-medium text-white'>
							DEFAULT LOOP TIME (seconds)
						</label>
						<input
							type='number'
							id='default_loop_time'
							className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
							placeholder=''
							inputMode='numeric'
							value={formState.defaultLoopTime}
							onChange={(e) => handleNumberInputChange(e, "defaultLoopTime")}
							required
						/>
					</div>
				</div>

				{/* others */}
				<div className='mt-6 flex flex-col md:flex-row md:space-x-4'>
					<div>
						<label
							htmlFor='rate_limit'
							className='block mb-2 text-sm font-medium text-white'>
							RATE LIMIT
						</label>
						<input
							type='number'
							id='rate_limit'
							className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
							placeholder=''
							inputMode='numeric'
							value={formState.rateLimit}
							onChange={(e) => handleNumberInputChange(e, "rateLimit")}
							required
						/>
					</div>
					<div>
						<label
							htmlFor='bid_expiration'
							className='block mb-2 text-sm font-medium text-white'>
							BID EXPIRATION (minutes)
						</label>
						<input
							type='number'
							id='bid_expiration'
							className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
							placeholder=''
							inputMode='numeric'
							value={formState.bidExpiration}
							onChange={(e) => handleNumberInputChange(e, "bidExpiration")}
							required
						/>
					</div>
					<div>
						<label
							htmlFor='default_outbid_margin'
							className='block mb-2 text-sm font-medium text-white'>
							DEFAULT OUTBID MARGIN (BTC)
						</label>
						<input
							type='number'
							id='default_outbid_margin'
							className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
							placeholder=''
							inputMode='numeric'
							value={formState.defaultOutbidMargin}
							onChange={(e) =>
								handleNumberInputChange(e, "defaultOutbidMargin")
							}
							required
						/>
					</div>
				</div>

				<div className='flex justify-end mt-6'>
					<button
						className='bg-[#CB3CFF] py-[14px] w-[180px] font-semibold text-white text-sm rounded'
						onClick={saveSettings}>
						SAVE
					</button>
				</div>
			</div>
		</div>
	);
};

export default Settings;

interface SettingsState {
	apiKey: string;
	fundingWif: string;
	tokenReceiveAddress: string;
	rateLimit: number;
	bidExpiration: number;
	defaultOutbidMargin: number;
	defaultLoopTime: number;
}
