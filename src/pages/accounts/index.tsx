import DownloadIcon from "@/assets/icons/DownloadIcon";
import InvisibleIcon from "@/assets/icons/InvisibleIcon";
import PlusIcon from "@/assets/icons/PlusIcon";
import VisibleIcon from "@/assets/icons/VisibleIcon";
import { IValidateWallet, Wallet } from "@/interface/account.interface";
import { useAccountState } from "@/store/account.store";
import axios from "axios";
import React, { ChangeEvent, useState } from "react";
import { toast } from "react-toastify";

const Accounts = () => {
	const [isLoading, setIsLoading] = useState(false);
	const [createdWallets, setCreatedWallets] = useState<Wallet[]>([]);
	const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);
	const [addPrivatekey, setAddPrivatekey] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [privateKey, setPrivateKey] = useState("");
	const { addWallet, wallets, removeWallet } = useAccountState();

	const [showPrivateKeys, setShowPrivateKeys] = useState<boolean[]>(
		new Array(wallets.length).fill(false)
	);
	async function createWallet() {
		try {
			setIsLoading(true);
			const { data } = await axios.get<Wallet>("/api/account");

			const { privateKey } = data;

			const { data: wallet } = await axios.post<IValidateWallet>(
				"/api/account/validate",
				{
					privateKey,
				}
			);
			const { isBitcoin, address } = wallet;

			if (isBitcoin) {
				addWallet(privateKey, address);
			}
			setCreatedWallets([wallet]);
			setShowDownloadPrompt(true);
		} catch (error) {
			toast.error("Failed to create wallet. Please try again.");
			console.log(error);
		} finally {
			setIsLoading(false);
		}
	}

	function downloadWalletsAsText() {
		const walletsText = createdWallets
			.map((wallet) => wallet.privateKey)
			.join("\n");
		const element = document.createElement("a");
		const file = new Blob([walletsText], { type: "text/plain" });
		element.href = URL.createObjectURL(file);
		element.download = "wallet.txt";
		document.body.appendChild(element);
		element.click();
		document.body.removeChild(element);
		setShowDownloadPrompt(false);
	}

	async function handlePrivateKeySubmit() {
		try {
			if (privateKey) {
				const { data: wallet } = await axios.post<IValidateWallet>(
					"/api/account/validate",
					{
						privateKey,
					}
				);
				const { isBitcoin, address } = wallet;

				if (isBitcoin) {
					addWallet(privateKey, address);
				}
			}
		} catch (error) {
			toast.error("Failed to add wallet. Please try again.");
			console.log(error);
		} finally {
			setAddPrivatekey(false);
			setPrivateKey("");
		}
	}

	const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
		try {
			const file = event.target.files?.[0];
			if (file && file.type === "text/plain") {
				const reader = new FileReader();
				reader.onload = async (e) => {
					const content = e.target?.result as string;
					const { data: wallet } = await axios.post<IValidateWallet>(
						"/api/account/validate",
						{
							privateKey: content,
						}
					);
					const { isBitcoin, address } = wallet;

					if (isBitcoin) {
						addWallet(content, address);
					}
				};
				reader.readAsText(file);
			} else {
				console.log("Invalid file type. Please select a TXT file.");
			}
		} catch (error) {
			console.log(error);
		}
	};

	const togglePrivateKeyVisibility = (index: number) => {
		setShowPrivateKeys((prevState) => {
			const updatedState = [...prevState];
			updatedState[index] = !updatedState[index];
			return updatedState;
		});
	};
	const handleRemoveWallet = (index: number) => {
		removeWallet(index);
		toast.success("Wallet removed successfully!");
	};

	return (
		<div className='py-[30px] px-[40px]'>
			<h2 className='text-white text-[20px] font-semibold'>
				Account Management
			</h2>
			<p className='mt-2 text-[14px] font-medium text-[#AEB9E1]'>
				Create a new wallet or import an existing one to get started.
			</p>
			<div className='flex justify-end items-center gap-8'>
				<button
					className='bg-[#CB3CFF] px-3 py-[14px] w-[180px] font-semibold text-white text-sm rounded flex justify-center items-center gap-3 mt-6'
					onClick={() => setAddPrivatekey(true)}
					disabled={isLoading}>
					Enter Private Key
				</button>
				<button
					className='bg-[#CB3CFF] px-3 py-[14px] w-[180px] font-semibold text-white text-sm rounded flex justify-center items-center gap-3 mt-6'
					onClick={createWallet}
					disabled={isLoading}>
					<PlusIcon /> Create New Wallet
				</button>
			</div>
			{/* private key input */}
			{addPrivatekey && (
				<div className='text-white mt-8 flex gap-4 items-center'>
					<div className='relative w-[40%]'>
						<input
							type={showPassword ? "text" : "password"}
							id='funding_wif'
							className='p-[14px] bg-transparent border border-[#343B4F] w-full rounded text-white pr-10'
							placeholder=''
							value={privateKey}
							onChange={(e) => setPrivateKey(e.target.value)}
							required
						/>
						<button
							type='button'
							className='absolute right-3 top-[14px] text-white focus:outline-none'
							onClick={() => setShowPassword(!showPassword)}>
							{showPassword ? <InvisibleIcon /> : <VisibleIcon />}
						</button>
					</div>
					<button
						className='bg-[#CB3CFF] px-6 py-[14px] font-semibold text-white text-sm rounded'
						onClick={handlePrivateKeySubmit}>
						Add
					</button>
				</div>
			)}

			{showDownloadPrompt && (
				<div className='mt-8'>
					<p className='text-white'>Wallet created successfully!</p>
					<button
						className='mt-4 bg-[#CB3CFF] px-3 py-[10px] font-semibold text-white text-sm rounded flex gap-2 items-center'
						onClick={downloadWalletsAsText}>
						Download Wallet
						<DownloadIcon />
					</button>
				</div>
			)}

			<div className='flex items-center justify-center w-full mt-16'>
				<label
					htmlFor='dropzone-file'
					className='flex flex-col items-center justify-center w-full h-64 rounded-lg cursor-pointer bg-[#0b1739]'>
					<div className='flex flex-col items-center justify-center pt-5 pb-6'>
						<svg
							className='w-8 h-8 mb-4 text-gray-500 dark:text-gray-400'
							aria-hidden='true'
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 20 16'>
							<path
								stroke='currentColor'
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth='2'
								d='M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2'
							/>
						</svg>
						<p className='mb-2 text-sm text-gray-500 dark:text-gray-400'>
							<span className='font-semibold'>Click to upload</span> or drag and
							drop
						</p>
						<p className='text-xs text-gray-500 dark:text-gray-400'>
							TXT files only
						</p>
					</div>
					<input
						id='dropzone-file'
						type='file'
						className='hidden'
						accept='.txt'
						onChange={handleFileUpload}
					/>
				</label>
			</div>

			<h4 className='mt-6 text-[14px] font-medium text-[#AEB9E1]'>
				Manage your keys
			</h4>
			<div className='mt-6'>
				<div className='relative overflow-x-auto shadow-md'>
					<table className='w-full text-sm text-left text-white border border-[#343B4F] rounded-lg'>
						<thead className='text-xs bg-[#0A1330]'>
							<tr>
								<th scope='col' className='px-6 py-5'>
									Label
								</th>
								<th scope='col' className='px-6 py-5'>
									Address
								</th>
								<th scope='col' className='px-6 py-5'>
									Private Key
								</th>
								<th scope='col' className='px-6 py-5'>
									Actions
								</th>
							</tr>
						</thead>
						<tbody>
							{wallets.map((wallet, index) => (
								<tr
									key={index}
									className={`${
										index % 2 === 0 ? "bg-[#0b1739]" : "bg-[#091330]"
									}`}>
									<td className='px-6 py-5'>{wallet.label}</td>
									<td className='px-6 py-5'>{wallet.address}</td>
									<td className='px-6 py-5 flex items-center'>
										{showPrivateKeys[index] ? (
											wallet.privateKey
										) : (
											<span className='blur-sm'>••••••••</span>
										)}
										<button
											className='ml-2 focus:outline-none'
											onClick={() => togglePrivateKeyVisibility(index)}>
											{showPrivateKeys[index] ? (
												<InvisibleIcon />
											) : (
												<VisibleIcon />
											)}
										</button>
									</td>
									<td className='px-6 py-5'>
										<button
											className='text-red-500 focus:outline-none'
											onClick={() => handleRemoveWallet(index)}>
											Delete
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};

export default Accounts;
