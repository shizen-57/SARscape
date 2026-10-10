"""Dispatch official local NISAR products without inventing missing channels."""
import argparse,json
import h5py
from goff import process as goff_process,text
from gcov import process as gcov_process
from process_lifecycle import watch_parent
watch_parent()
parser=argparse.ArgumentParser();parser.add_argument('--input',required=True);parser.add_argument('--output',required=True);parser.add_argument('--scenario',required=True);parser.add_argument('--frequency',default='A');parser.add_argument('--polarization',default='HH');parser.add_argument('--layer',default='layer1');parser.add_argument('--correlation',type=float,default=.3)
parser.add_argument('--parent-pid');args=parser.parse_args()
try:
    with h5py.File(args.input,'r') as source:product=text(source['/science/LSAR/identification/productType'][()])
    if product=='GOFF':result=goff_process(args.input,args.output,args.scenario,args.frequency,args.polarization,args.layer,args.correlation)
    elif product=='GCOV':result=gcov_process(args.input,args.output,args.scenario,args.frequency,args.polarization)
    else:raise ValueError('Only NISAR L2 GOFF and GCOV products are supported')
    print(json.dumps(result),flush=True)
except Exception as error:parser.exit(1,str(error))
